const express = require("express");
const cors = require("cors");
const pool = require("./db");
const app = express();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs"); // Tek seferde tanımladık

// --- 1. AYARLAR VE MIDDLEWARE ---
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Uploads klasörü kontrolü
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use("/uploads", express.static("uploads"));

// Dosya Yükleme Ayarı (Multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});
const upload = multer({ storage: storage });

// ==========================================
// ROTALAR (ENDPOINTS)
// ==========================================
async function klasorHiyerarsisiOlustur(klasorAdlari, olusturan) {
  let ustKlasorId = null;

  for (const ad of klasorAdlari) {
    if (!ad) continue;

    let sorgu = "SELECT id FROM klasorler WHERE ad = $1";
    let params = [ad];

    if (ustKlasorId) {
      sorgu += " AND ust_klasor_id = $2";
      params.push(ustKlasorId);
    } else {
      sorgu += " AND ust_klasor_id IS NULL";
    }

    const varMi = await pool.query(sorgu, params);

    if (varMi.rows.length > 0) {
      ustKlasorId = varMi.rows[0].id;
    } else {
      const yeni = await pool.query(
        "INSERT INTO klasorler (ad, ust_klasor_id, olusturan) VALUES ($1, $2, $3) RETURNING id",
        [ad, ustKlasorId, olusturan]
      );
      ustKlasorId = yeni.rows[0].id;
    }
  }
  return ustKlasorId;
}

// --- GÖREV YÖNETİMİ ---

// 1. Görev Listeleme (Projeyle Birleştirilmiş)
app.get("/gorevler", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.*, p.ad as proje_adi 
      FROM gorevler g
      LEFT JOIN projeler p ON g.proje_id = p.id
      ORDER BY g.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Sunucu hatası");
  }
});
app.get("/gorevler/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `
      SELECT g.*, p.ad as proje_adi 
      FROM gorevler g
      LEFT JOIN projeler p ON g.proje_id = p.id
      WHERE g.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Görev bulunamadı" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Sunucu hatası");
  }
});

// 2. GÖREV EKLEME (ÇOKLU DOSYA + AKILLI KLASÖRLEME)
// Dikkat: 'dosyalar' adında array bekliyoruz, max 10 dosya
app.post("/gorevler", upload.array("dosyalar", 10), async (req, res) => {
  try {
    const {
      baslik,
      aciklama,
      oncelik,
      tarih,
      atananlar,
      gozlemciler,
      proje_id,
      tekrar_tipi,
    } = req.body;

    // JSON parse
    let atananlarParsed = atananlar ? JSON.parse(atananlar) : [];
    let gozlemcilerParsed = gozlemciler ? JSON.parse(gozlemciler) : [];
    const pid =
      proje_id && proje_id !== "null" && proje_id !== "undefined"
        ? proje_id
        : null;

    // Not: Dosya yolu sütununa, eğer tek dosya ise ismini, çoksa "Çoklu Dosya" yazarız
    //veya ilk dosyanın adını yazarız. UI'da göstermek için.
    const dosya_yolu_db =
      req.files && req.files.length > 0
        ? req.files.length === 1
          ? req.files[0].filename
          : "COKLU_DOSYA"
        : null;

    // 1. GÖREVİ KAYDET
    const result = await pool.query(
      "INSERT INTO gorevler (baslik, aciklama, oncelik, tarih, durum, atananlar, gozlemciler, dosya_yolu, proje_id, tekrar_tipi) VALUES ($1, $2, $3, $4, 'Bekliyor', $5, $6, $7, $8, $9) RETURNING *",
      [
        baslik,
        aciklama,
        oncelik,
        tarih,
        atananlarParsed,
        gozlemcilerParsed,
        dosya_yolu_db,
        pid,
        tekrar_tipi || "Tek Seferlik",
      ]
    );
    const yeniGorevId = result.rows[0].id;

    // 2. DRIVE MANTIĞI 🧠
    if (req.files && req.files.length > 0) {
      const olusturanKisi = "Sistem";
      let hedefKlasorId = null;

      // A. Ana Rotayı Belirle: [Departman] > [Proje] veya [Genel Görevler]
      let anaRotaKlasorId = null;
      if (pid) {
        const projeBilgi = await pool.query(
          "SELECT ad, departman FROM projeler WHERE id = $1",
          [pid]
        );
        if (projeBilgi.rows.length > 0) {
          const { ad: projeAdi, departman: projeDepartman } =
            projeBilgi.rows[0];
          anaRotaKlasorId = await klasorHiyerarsisiOlustur(
            [projeDepartman, projeAdi],
            olusturanKisi
          );
        }
      } else {
        anaRotaKlasorId = await klasorHiyerarsisiOlustur(
          ["Genel Görevler"],
          olusturanKisi
        );
      }

      // B. Dosya Sayısına Göre Karar Ver
      if (req.files.length > 1) {
        // DURUM 1: BİRDEN FAZLA DOSYA VAR -> GÖREV İÇİN KLASÖR AÇ
        // Format: [Departman] > [Proje] > [#125 - Görev Başlığı]
        const gorevKlasorAdi = `#${yeniGorevId} - ${baslik}`;

        // Bu klasörü oluştur (anaRotaKlasorId'nin içine)
        const gorevKlasorRes = await pool.query(
          "INSERT INTO klasorler (ad, ust_klasor_id, olusturan) VALUES ($1, $2, $3) RETURNING id",
          [gorevKlasorAdi, anaRotaKlasorId, olusturanKisi]
        );
        hedefKlasorId = gorevKlasorRes.rows[0].id;
      } else {
        // DURUM 2: TEK DOSYA VAR -> DİREKT PROJE KLASÖRÜNE KOY
        hedefKlasorId = anaRotaKlasorId;
      }

      // C. Dosyaları Kaydet (Döngü ile)
      for (const file of req.files) {
        let finalAd = file.originalname;

        // Eğer Tek dosya ise ve proje klasörüne koyuyorsak karışmasın diye ID ekleyelim
        if (req.files.length === 1) {
          finalAd = `#${yeniGorevId} - ${file.originalname}`;
        }
        // Eğer Görev klasörünün içindeysek dosya adını orjinal bırakabiliriz veya başına tarih atabiliriz
        // (Şimdilik orjinal bırakıyoruz, çünkü zaten özel klasörde)

        await pool.query(
          "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, yukleyen, klasor_id, tarih) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
          [
            finalAd,
            file.filename,
            file.filename,
            path.extname(file.originalname),
            file.size,
            "Görev Sistemi",
            hedefKlasorId,
          ]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("KAYIT HATASI:", err.message);
    res.status(500).send(err.message);
  }
});
// 4. Görev Silme
app.delete("/gorevler/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Önce görevin dosya yolunu al
    const gorevSorgu = await pool.query(
      "SELECT dosya_yolu FROM gorevler WHERE id = $1",
      [id]
    );

    if (gorevSorgu.rows.length === 0) {
      return res.status(404).json({ error: "Görev bulunamadı" });
    }

    await pool.query("DELETE FROM gorevler WHERE id = $1", [id]);
    res.json({ mesaj: "Görev silindi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Silme hatası" });
  }
});

// 3. GÖREV GÜNCELLEME (DOSYA YÜKLEME DESTEKLİ - YENİ)
app.put("/gorevler/:id", upload.single("dosya"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      baslik,
      aciklama,
      oncelik,
      tarih,
      durum,
      atananlar,
      gozlemciler,
      proje_id,
      tekrar_tipi,
    } = req.body;

    const yeni_dosya_yolu = req.file ? req.file.filename : undefined;

    // 1. Önce eski kaydı çek
    const eskiGorevSorgu = await pool.query(
      "SELECT * FROM gorevler WHERE id = $1",
      [id]
    );

    if (eskiGorevSorgu.rows.length === 0) {
      return res.status(404).json({ error: "Görev bulunamadı" });
    }

    const eskiGorev = eskiGorevSorgu.rows[0];

    // 2. JSON parse işlemi (güvenli)
    let atananlarParsed = eskiGorev.atananlar;
    let gozlemcilerParsed = eskiGorev.gozlemciler;

    try {
      if (atananlar !== undefined) {
        atananlarParsed = atananlar
          ? JSON.parse(atananlar)
          : eskiGorev.atananlar;
      }
      if (gozlemciler !== undefined) {
        gozlemcilerParsed = gozlemciler
          ? JSON.parse(gozlemciler)
          : eskiGorev.gozlemciler;
      }
    } catch (parseErr) {
      console.warn(
        "JSON parse hatası, eski değerler korunuyor:",
        parseErr.message
      );
    }

    // 3. Yeni değerleri belirle
    const y_baslik = baslik !== undefined ? baslik : eskiGorev.baslik;
    const y_aciklama = aciklama !== undefined ? aciklama : eskiGorev.aciklama;
    const y_oncelik = oncelik !== undefined ? oncelik : eskiGorev.oncelik;
    const y_tarih = tarih !== undefined ? tarih : eskiGorev.tarih;
    const y_durum = durum !== undefined ? durum : eskiGorev.durum;
    const y_proje_id =
      proje_id && proje_id !== "null" ? proje_id : eskiGorev.proje_id;
    const y_tekrar_tipi =
      tekrar_tipi !== undefined ? tekrar_tipi : eskiGorev.tekrar_tipi;

    // Dosya yolu: yeni dosya varsa onu kullan, yoksa eskisini koru
    const y_dosya_yolu =
      yeni_dosya_yolu !== undefined ? yeni_dosya_yolu : eskiGorev.dosya_yolu;

    // 4. Veritabanını Güncelle
    const update = await pool.query(
      `UPDATE gorevler SET 
       baslik=$1, aciklama=$2, oncelik=$3, tarih=$4, durum=$5, 
       atananlar=$6, gozlemciler=$7, proje_id=$8, tekrar_tipi=$9, dosya_yolu=$10
       WHERE id=$11 RETURNING *`,
      [
        y_baslik,
        y_aciklama,
        y_oncelik,
        y_tarih,
        y_durum,
        atananlarParsed,
        gozlemcilerParsed,
        y_proje_id,
        y_tekrar_tipi,
        y_dosya_yolu,
        id,
      ]
    );

    // 5. YENİ DOSYA VARSA DRIVE'A KAYDET
    if (req.file) {
      await pool.query(
        `INSERT INTO dosyalar 
         (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, yukleyen, tarih) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          req.file.originalname,
          req.file.filename,
          req.file.filename,
          path.extname(req.file.originalname),
          req.file.size,
          "Görev Sistemi",
        ]
      );
    }

    // 6. Bildirim Mantığı
    if (y_durum !== eskiGorev.durum) {
      let bildirimMesajı = "";
      if (y_durum === "Onay Bekliyor")
        bildirimMesajı = `⚠️ "${y_baslik}" onaya sunuldu.`;
      else if (y_durum === "Yapıldı")
        bildirimMesajı = `✅ "${y_baslik}" tamamlandı.`;
      else if (y_durum === "Bekliyor" && eskiGorev.durum === "Onay Bekliyor")
        bildirimMesajı = `❌ "${y_baslik}" reddedildi.`;

      if (bildirimMesajı) {
        await pool.query(
          "INSERT INTO bildirimler (mesaj, kime, gorev_id) VALUES ($1, $2, $3)",
          [bildirimMesajı, "İlgililer", id]
        );
      }
    }

    // 7. Güncellenmiş veriyi proje bilgisiyle döndür
    const finalResult = await pool.query(
      `
      SELECT g.*, p.ad as proje_adi 
      FROM gorevler g
      LEFT JOIN projeler p ON g.proje_id = p.id
      WHERE g.id = $1
    `,
      [id]
    );

    res.json(finalResult.rows[0]);
  } catch (err) {
    console.error("GÖREV GÜNCELLEME HATASI:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- YORUM VE İLETİŞİM ---

// 5. Yorumları Getir
app.get("/gorevler/:id/yorumlar", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM yorumlar WHERE gorev_id = $1 ORDER BY tarih ASC",
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
  }
});

// 6. Yorum Ekle (Bildirimli)
app.post("/gorevler/:id/yorumlar", async (req, res) => {
  try {
    const { id } = req.params;
    const { yazan_kisi, mesaj } = req.body;

    const result = await pool.query(
      "INSERT INTO yorumlar (gorev_id, yazan_kisi, mesaj) VALUES ($1, $2, $3) RETURNING *",
      [id, yazan_kisi, mesaj]
    );

    let bildirimMesajı = `💬 ${yazan_kisi} bir yorum yazdı.`;
    if (mesaj.includes("@")) {
      bildirimMesajı = `📣 ${yazan_kisi} senden bahsetti!`;
    }

    await pool.query(
      "INSERT INTO bildirimler (mesaj, kime, gorev_id) VALUES ($1, $2, $3)",
      [bildirimMesajı, "İlgililer", id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
  }
});

// --- PROJE YÖNETİMİ ---

// 7. Projeleri Getir
app.get("/projeler", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM projeler ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
  }
});

// 8. Yeni Proje Ekle
app.post("/projeler", async (req, res) => {
  try {
    const { ad, departman, baslangic_tarihi, bitis_tarihi, olusturan } =
      req.body;
    const result = await pool.query(
      "INSERT INTO projeler (ad, departman, baslangic_tarihi, bitis_tarihi, olusturan) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [ad, departman, baslangic_tarihi, bitis_tarihi, olusturan]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
  }
});

// --- GENEL VERİLER VE DASHBOARD ---

app.get("/kullanicilar", async (req, res) => {
  try {
    const result = await pool.query(`
    SELECT k.*, y.ad_soyad as yonetici_adi 
    FROM kullanicilar k
    LEFT JOIN kullanicilar y ON k.yonetici_id = y.id
    ORDER BY k.ad_soyad ASC
`);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
  }
});
// --- CEO DASHBOARD API (DÜZELTİLDİ: ID'ler Eklendi) ---
app.get("/dashboard/ozet", async (req, res) => {
  try {
    // 1. Temel Sayılar
    const toplam = await pool.query("SELECT COUNT(*) FROM gorevler");
    const biten = await pool.query(
      "SELECT COUNT(*) FROM gorevler WHERE durum = 'Yapıldı'"
    );
    const bekleyen = await pool.query(
      "SELECT COUNT(*) FROM gorevler WHERE durum != 'Yapıldı'"
    );

    // 2. Grafikler
    const aciliyet = await pool.query(
      "SELECT oncelik, COUNT(*)::int as count FROM gorevler GROUP BY oncelik"
    );
    const personel = await pool.query(
      `SELECT unnest(atananlar) as isim, COUNT(*)::int as is_sayisi FROM gorevler WHERE durum != 'Yapıldı' GROUP BY isim`
    );

    // 3. Finans
    const finans = await pool.query(
      `SELECT COALESCE(SUM(tutar), 0) as toplam_tutar FROM satin_alma WHERE durum LIKE '%Bekliyor%'`
    );

    // 4. İK
    const izin = await pool.query(
      `SELECT COUNT(*) FROM izinler WHERE durum LIKE 'Onaylandı%' AND CURRENT_DATE BETWEEN baslangic_tarihi AND bitis_tarihi`
    );

    // 5. Proje İlerleme Durumları (DÜZELTME: p.id eklendi)
    const projeDurum = await pool.query(`
        SELECT p.id, p.ad, 
               COUNT(g.id)::int as toplam_is,
               SUM(CASE WHEN g.durum = 'Yapıldı' THEN 1 ELSE 0 END)::int as biten_is
        FROM projeler p
        LEFT JOIN gorevler g ON p.id = g.proje_id
        GROUP BY p.id
    `);

    // 6. Yaklaşan Teslim Tarihleri (DÜZELTME: id eklendi)
    const riskliIsler = await pool.query(`
        SELECT id, baslik, tarih, atananlar 
        FROM gorevler 
        WHERE durum != 'Yapıldı' 
        AND tarih IS NOT NULL 
        AND tarih <= CURRENT_DATE + INTERVAL '3 days'
        ORDER BY tarih ASC
        LIMIT 5
    `);

    res.json({
      toplam: toplam.rows[0].count,
      biten: biten.rows[0].count,
      bekleyen: bekleyen.rows[0].count,
      aciliyet: aciliyet.rows,
      personel: personel.rows,
      bekleyen_odeme: finans.rows[0].toplam_tutar,
      bugun_izinli: izin.rows[0].count,
      proje_durumlari: projeDurum.rows,
      riskli_isler: riskliIsler.rows,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Dashboard Hatası");
  }
});

// --- BİLDİRİMLER ---

app.get("/bildirimler", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM bildirimler ORDER BY tarih DESC LIMIT 20"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
  }
});

app.put("/bildirimler/hepsini-oku", async (req, res) => {
  try {
    await pool.query(
      "UPDATE bildirimler SET okundu = TRUE WHERE okundu = FALSE"
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
  }
});
// PERSONELE YÖNETİCİ ATA (DÖNGÜ KONTROLLÜ 🛡️)
app.put("/kullanicilar/yonetici-ata/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id); // Personel (Ast)
    const yonetici_id = req.body.yonetici_id
      ? parseInt(req.body.yonetici_id)
      : null; // Yeni Yönetici (Üst)

    // 1. Kendi Kendine Yönetici Olamaz
    if (id === yonetici_id) {
      return res.status(400).json({ error: "Kişi kendi yöneticisi olamaz." });
    }

    // 2. Döngüsel Kontrol (Circular Reference Check)
    // Eğer yönetici atanıyorsa (null değilse), zinciri kontrol et
    if (yonetici_id) {
      let kontrolId = yonetici_id;
      let donguVar = false;

      // Zinciri yukarı doğru 10 seviyeye kadar tara (Sonsuz döngü riskine karşı limit)
      for (let i = 0; i < 10; i++) {
        // Seçilen yöneticinin de yöneticisine bak
        const result = await pool.query(
          "SELECT yonetici_id FROM kullanicilar WHERE id = $1",
          [kontrolId]
        );

        if (result.rows.length === 0) break; // Kayıt yoksa dur

        const ustYonetici = result.rows[0].yonetici_id;

        if (ustYonetici === id) {
          donguVar = true; // Bingo! Zincirin ucu tekrar bize çıktı
          break;
        }

        if (!ustYonetici) break; // Zincirin sonuna geldik (Genel Müdür vs.)
        kontrolId = ustYonetici; // Bir üst basamağa geç
      }

      if (donguVar) {
        return res.status(400).json({
          error:
            "HATA: Döngüsel atama! Seçtiğiniz kişi zaten bu personelin astı.",
        });
      }
    }

    // 3. Sorun Yoksa Güncelle
    await pool.query("UPDATE kullanicilar SET yonetici_id = $1 WHERE id = $2", [
      yonetici_id,
      id,
    ]);
    res.json({ message: "Yönetici atandı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});
// PERSONELİN YÖNETİCİSİNİ KALDIR (BAĞLANTIYI KES)
app.put("/kullanicilar/yonetici-sil/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE kullanicilar SET yonetici_id = NULL WHERE id = $1",
      [id]
    );
    res.json({ message: "Yönetici bağlantısı kaldırıldı." });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});
// --- KULLANICI YÖNETİMİ (ADMİN) ---

// KULLANICI GÜNCELLE (Admin Panelinden)
// 1. KULLANICI BİLGİLERİNİ GÜNCELLE (ADMİN) - GÜNCELLENDİ
app.put("/kullanicilar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // 'toplam_izin_hakki' eklendi
    const {
      ad_soyad,
      email,
      departman,
      pozisyon,
      rol,
      hesap_durumu,
      toplam_izin_hakki,
    } = req.body;

    await pool.query(
      "UPDATE kullanicilar SET ad_soyad=$1, email=$2, departman=$3, pozisyon=$4, rol=$5, hesap_durumu=$6, toplam_izin_hakki=$7 WHERE id=$8",
      [
        ad_soyad,
        email,
        departman,
        pozisyon,
        rol,
        hesap_durumu,
        toplam_izin_hakki,
        id,
      ]
    );
    res.json({ message: "Kullanıcı güncellendi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// KULLANICI SİL
app.delete("/kullanicilar/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM kullanicilar WHERE id = $1", [req.params.id]);
    res.json({ message: "Kullanıcı silindi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});
// ==========================================
// --- SATIN ALMA / FİNANS MODÜLÜ ---
// ==========================================

// 1. TALEPLERİ GETİR (DEPARTMAN FİLTRELİ 🛡️)
app.get("/satin-alma", async (req, res) => {
  try {
    const { userId } = req.query; // Frontend'den "Ben kimim?" bilgisini al

    if (!userId) return res.json([]); // Kimlik yoksa veri yok

    // 1. İsteyen kişinin bilgilerini (Rol ve Departman) çek
    const userRes = await pool.query(
      "SELECT * FROM kullanicilar WHERE id = $1",
      [userId]
    );
    if (userRes.rows.length === 0) return res.json([]);
    const user = userRes.rows[0];

    let query = "";
    let params = [];

    // 2. Yetki Kontrolü
    // Genel Müdür, Yönetim, Finans veya Muhasebe ise -> HER ŞEYİ GÖR
    if (
      ["Genel Müdür", "Yönetim", "Finans", "Muhasebe"].some(
        (r) => user.rol.includes(r) || user.departman.includes(r)
      )
    ) {
      query = "SELECT * FROM satin_alma ORDER BY id DESC";
    }
    // Yoksa -> SADECE KENDİ DEPARTMANINI GÖR
    else {
      query = "SELECT * FROM satin_alma WHERE departman = $1 ORDER BY id DESC";
      params = [user.departman];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 2. YENİ TALEP OLUŞTUR (GÜNCELLENDİ)
app.post("/satin-alma", upload.single("dosya"), async (req, res) => {
  try {
    // proje_id ve departman eklendi
    const {
      talep_eden,
      baslik,
      aciklama,
      tutar,
      para_birimi,
      proje_id,
      departman,
    } = req.body;
    const dosya_yolu = req.file ? req.file.filename : null;

    // Proje ID boş gelirse null yap
    const pid =
      proje_id && proje_id !== "undefined" && proje_id !== "null"
        ? proje_id
        : null;

    const result = await pool.query(
      "INSERT INTO satin_alma (talep_eden, baslik, aciklama, tutar, para_birimi, dosya_yolu, proje_id, departman) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [
        talep_eden,
        baslik,
        aciklama,
        tutar,
        para_birimi,
        dosya_yolu,
        pid,
        departman,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 3. ONAY MEKANİZMASI (BEYİN BURASI 🧠)
app.put("/satin-alma/onay/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { onaylayan_rol, islem } = req.body; // islem: 'Onayla' veya 'Reddet'

    // Önce mevcut kaydı çekelim (Tutarını kontrol edeceğiz)
    const kayitSorgu = await pool.query(
      "SELECT * FROM satin_alma WHERE id = $1",
      [id]
    );
    const kayit = kayitSorgu.rows[0];

    let yeniDurum = kayit.durum;
    let finansOnayi = kayit.finans_onayi;
    let gmOnayi = kayit.genel_mudur_onayi;

    // --- SENARYO A: REDDETME ---
    if (islem === "Reddet") {
      yeniDurum = "Reddedildi";
      if (
        onaylayan_rol.includes("Finans") ||
        onaylayan_rol.includes("Muhasebe")
      )
        finansOnayi = false;
      if (onaylayan_rol.includes("Genel Müdür")) gmOnayi = false;
    }

    // --- SENARYO B: ONAYLAMA ---
    else if (islem === "Onayla") {
      // 1. Finans Onaylıyorsa
      if (
        onaylayan_rol.includes("Finans") ||
        onaylayan_rol.includes("Muhasebe")
      ) {
        finansOnayi = true;

        // Tutar Kuralı: 10.000 TL altı ise veya zaten GM onayı varsa -> BİTİR
        if (parseFloat(kayit.tutar) <= 10000) {
          yeniDurum = "Onaylandı (Satın Alınacak)";
        } else {
          // 10.000 TL üstü ise -> GM'ye pasla
          yeniDurum = "Genel Müdür Onayı Bekliyor";
        }
      }

      // 2. Genel Müdür Onaylıyorsa
      if (onaylayan_rol.includes("Genel Müdür")) {
        gmOnayi = true;
        // GM onaylarsa her türlü biter (Finans zaten onaylamıştır veya GM bypass eder)
        yeniDurum = "Onaylandı (Satın Alınacak)";
      }
    }

    // Güncelle
    await pool.query(
      "UPDATE satin_alma SET durum=$1, finans_onayi=$2, genel_mudur_onayi=$3 WHERE id=$4",
      [yeniDurum, finansOnayi, gmOnayi, id]
    );

    res.json({ message: "İşlem Başarılı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// --- KİMLİK DOĞRULAMA (AUTH) ---

// A. KAYIT OL (YÖNETİCİ ONAYLI SİSTEM)
app.post("/auth/register", async (req, res) => {
  try {
    const { ad_soyad, email, sifre, departman, pozisyon, rol } = req.body;

    // 1. Şifreleme
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(sifre, salt);

    // 2. Rol Kontrolü (İlk kayıt olan GM olsun, sonrakiler Onay Beklesin)
    // Basit mantık: Eğer veritabanı boşsa ilk kişi Aktif GM olur. Değilse Bekliyor olur.
    const userCount = await pool.query("SELECT COUNT(*) FROM kullanicilar");
    let durum = "Bekliyor";
    let secilenRol = rol || "Personel";

    if (parseInt(userCount.rows[0].count) === 0) {
      durum = "Aktif";
      secilenRol = "Genel Müdür";
    }

    // 3. Kullanıcıyı Kaydet
    const newUser = await pool.query(
      "INSERT INTO kullanicilar (ad_soyad, email, sifre, departman, pozisyon, rol, hesap_durumu) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [ad_soyad, email, hashedPassword, departman, pozisyon, secilenRol, durum]
    );

    // 4. YÖNETİCİLERE BİLDİRİM AT (Sadece durum 'Bekliyor' ise)
    if (durum === "Bekliyor") {
      const bildirimMesajı = `👤 YENİ PERSONEL: "${ad_soyad}" aramıza katılmak istiyor. Onayınız bekleniyor.`;

      // Tüm yöneticileri bul (GM, İK, Müdürler)
      // Not: Array içindeki rollere sahip herkese gider.
      const yoneticiler = await pool.query(`
            SELECT ad_soyad FROM kullanicilar 
            WHERE rol IN ('Genel Müdür', 'İnsan Kaynakları', 'Yönetim', 'Departman Müdürü')
        `);

      for (let yonetici of yoneticiler.rows) {
        await pool.query(
          "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
          [bildirimMesajı, yonetici.ad_soyad]
        );
      }
    }

    res.json(newUser.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Bu email zaten kayıtlı olabilir.");
  }
});

// B. GİRİŞ YAP (ONAY KONTROLLÜ)
app.post("/auth/login", async (req, res) => {
  try {
    const { email, sifre } = req.body;

    // 1. Kullanıcı var mı?
    const user = await pool.query(
      "SELECT * FROM kullanicilar WHERE email = $1",
      [email]
    );
    if (user.rows.length === 0) {
      return res.status(401).json("Email veya şifre hatalı");
    }

    // 2. --- YENİ KONTROL: Hesap Onaylı mı? ---
    if (user.rows[0].hesap_durumu === "Bekliyor") {
      return res
        .status(403)
        .json(
          "Hesabınız henüz yönetici tarafından onaylanmadı. Lütfen bekleyin."
        );
    }
    if (user.rows[0].hesap_durumu === "Reddedildi") {
      return res.status(403).json("Üyelik talebiniz reddedilmiştir.");
    }
    // -----------------------------------------

    // 3. Şifre Kontrolü
    const validPassword = await bcrypt.compare(sifre, user.rows[0].sifre);
    if (!validPassword) {
      return res.status(401).json("Email veya şifre hatalı");
    }

    const { sifre: p, ...userInfo } = user.rows[0];
    res.json(userInfo);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Sunucu Hatası");
  }
});

app.post("/auth/avatar/:id", upload.single("avatar"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).send("Dosya yüklenemedi.");

    const dosyaAdi = req.file.filename;
    await pool.query("UPDATE kullanicilar SET avatar = $1 WHERE id = $2", [
      dosyaAdi,
      id,
    ]);
    res.json({ avatar: dosyaAdi });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

app.put("/auth/profil/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { ad_soyad, departman, pozisyon, email } = req.body;
    const update = await pool.query(
      "UPDATE kullanicilar SET ad_soyad=$1, departman=$2, pozisyon=$3, email=$4 WHERE id=$5 RETURNING *",
      [ad_soyad, departman, pozisyon, email, id]
    );
    const { sifre, ...userInfo } = update.rows[0];
    res.json(userInfo);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

app.put("/auth/sifre/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { eskiSifre, yeniSifre } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM kullanicilar WHERE id = $1",
      [id]
    );
    const user = userResult.rows[0];

    const validPassword = await bcrypt.compare(eskiSifre, user.sifre);
    if (!validPassword) return res.status(401).json("Eski şifre hatalı");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(yeniSifre, salt);

    await pool.query("UPDATE kullanicilar SET sifre = $1 WHERE id = $2", [
      hashedPassword,
      id,
    ]);
    res.json({ message: "Şifre değiştirildi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});
// PERSONEL ONAYLA / REDDET
app.put("/auth/onay/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { durum } = req.body; // 'Aktif' veya 'Reddedildi'

    await pool.query(
      "UPDATE kullanicilar SET hesap_durumu = $1 WHERE id = $2",
      [durum, id]
    );
    res.json({ message: "Kullanıcı durumu güncellendi." });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// ==========================================
// --- İZİN YÖNETİMİ MODÜLÜ ---
// ==========================================

// 1. İZİNLERİ GETİR (HİYERARŞİK FİLTRELEME 🛡️)
app.get("/izinler", async (req, res) => {
  try {
    const { userId } = req.query; // Frontend'den "Kim soruyor?" bilgisini al

    if (!userId) return res.json([]);

    // Önce soran kişinin rolünü bulalım
    const userRes = await pool.query(
      "SELECT * FROM kullanicilar WHERE id = $1",
      [userId]
    );
    if (userRes.rows.length === 0) return res.json([]);
    const user = userRes.rows[0];

    let query = "";
    let params = [];

    // EĞER GENEL MÜDÜR VEYA İK İSE -> HERKESİ GÖR
    if (
      user.rol === "Genel Müdür" ||
      user.rol === "İnsan Kaynakları" ||
      user.departman === "Yönetim"
    ) {
      query = "SELECT * FROM izinler ORDER BY baslangic_tarihi DESC";
    }
    // DİĞERLERİ -> SADECE KENDİNİ VE ASTLARINI GÖR
    else {
      // Mantık: İzin tablosundaki 'kullanici_id' benim ID'm ise (Kendi iznim)
      // VEYA 'kullanici_id'ye sahip kişinin 'yonetici_id'si ben isem (Astımın izni)
      query = `
                SELECT i.* FROM izinler i
                LEFT JOIN kullanicilar k ON i.kullanici_id = k.id
                WHERE i.kullanici_id = $1 OR k.yonetici_id = $1
                ORDER BY i.baslangic_tarihi DESC
            `;
      params = [userId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});
// 2. YENİ İZİN TALEBİ (BİLDİRİMLİ & YÖNETİCİ TAKİPLİ)
app.post("/izinler", async (req, res) => {
  try {
    const {
      talep_eden,
      departman,
      tur,
      aciklama,
      baslangic_tarihi,
      bitis_tarihi,
      kullanici_id,
    } = req.body;

    const start = new Date(baslangic_tarihi);
    const end = new Date(bitis_tarihi);
    const diffTime = Math.abs(end - start);
    const gun_sayisi = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const result = await pool.query(
      "INSERT INTO izinler (talep_eden, departman, tur, aciklama, baslangic_tarihi, bitis_tarihi, gun_sayisi, kullanici_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [
        talep_eden,
        departman,
        tur,
        aciklama,
        baslangic_tarihi,
        bitis_tarihi,
        gun_sayisi,
        kullanici_id,
      ]
    );

    // --- BİLDİRİM MANTIĞI (SADECE YÖNETİCİYE) ---
    // 1. Kullanıcının yöneticisini bul
    const userRes = await pool.query(
      "SELECT yonetici_id FROM kullanicilar WHERE id = $1",
      [kullanici_id]
    );
    let yoneticiId =
      userRes.rows.length > 0 ? userRes.rows[0].yonetici_id : null;
    let hedefKisiIsmi = "";

    if (yoneticiId) {
      const yoneticiRes = await pool.query(
        "SELECT ad_soyad FROM kullanicilar WHERE id = $1",
        [yoneticiId]
      );
      if (yoneticiRes.rows.length > 0)
        hedefKisiIsmi = yoneticiRes.rows[0].ad_soyad;
    } else {
      hedefKisiIsmi = "Genel Müdür"; // Yöneticisi yoksa tepeye düşsün (İsteğe bağlı)
    }

    // 2. Bildirimi SADECE yöneticiye at (Talep edene atma)
    if (hedefKisiIsmi) {
      const mesaj = `📅 İZİN TALEBİ: ${talep_eden}, ${gun_sayisi} gün izin istiyor.`;
      await pool.query(
        "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
        [mesaj, hedefKisiIsmi]
      );
    }
    // -----------------------

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});
// 5. İZİN İPTAL ET
app.put("/izinler/iptal/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Sadece "Bekliyor" durumundakiler iptal edilebilir (Onaylanmış izin iptal edilemez, silinmesi gerekir)
    const kontrol = await pool.query(
      "SELECT durum FROM izinler WHERE id = $1",
      [id]
    );
    if (kontrol.rows[0].durum.includes("Onaylandı")) {
      return res.status(400).json({
        error: "Onaylanmış izin iptal edilemez. Yöneticinize başvurun.",
      });
    }

    await pool.query(
      "UPDATE izinler SET durum = 'İptal Edildi' WHERE id = $1",
      [id]
    );
    res.json({ message: "İzin talebi iptal edildi." });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 3. ONAY MEKANİZMASI (SONUÇLANINCA PERSONELE BİLDİRİM GİDER)
// 3. İZİN ONAY MEKANİZMASI (GM SÜPER YETKİLİ)
app.put("/izinler/onay/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { onaylayan_rol, islem } = req.body;

    const kayitSorgu = await pool.query("SELECT * FROM izinler WHERE id = $1", [
      id,
    ]);
    const kayit = kayitSorgu.rows[0];

    let yeniDurum = kayit.durum;
    let yoneticiOnayi = kayit.yonetici_onayi;
    let gmOnayi = kayit.genel_mudur_onayi;
    let bildirimAtilacakMi = false;

    // --- REDDETME ---
    if (islem === "Reddet") {
      yeniDurum = "Reddedildi";
      if (onaylayan_rol.includes("Müdür") || onaylayan_rol.includes("Yönetici"))
        yoneticiOnayi = false;
      if (onaylayan_rol.includes("Genel Müdür")) gmOnayi = false;
      bildirimAtilacakMi = true;
    }
    // --- ONAYLAMA ---
    else if (islem === "Onayla") {
      // SENARYO A: GENEL MÜDÜR ONAYLIYORSA (Tek seferde bitir)
      if (onaylayan_rol.includes("Genel Müdür")) {
        yoneticiOnayi = true; // Aradakileri de onaylanmış say
        gmOnayi = true;
        yeniDurum = "Onaylandı (İzinli)";
        bildirimAtilacakMi = true;
      }

      // SENARYO B: DEPARTMAN MÜDÜRÜ ONAYLIYORSA
      else if (
        onaylayan_rol.includes("Departman Müdürü") ||
        onaylayan_rol.includes("Yönetici")
      ) {
        yoneticiOnayi = true;
        yeniDurum = "Genel Müdür Onayı Bekliyor";
        // Personele değil, GM'ye bildirim gitmeli (Onu burada yapmıyoruz, şimdilik basit kalsın)
      }
    }

    await pool.query(
      "UPDATE izinler SET durum=$1, yonetici_onayi=$2, genel_mudur_onayi=$3 WHERE id=$4",
      [yeniDurum, yoneticiOnayi, gmOnayi, id]
    );

    // --- PERSONELE SONUÇ BİLDİRİMİ ---
    if (bildirimAtilacakMi) {
      const mesaj = `📝 İzin Durumu: Talebiniz "${yeniDurum}" olarak güncellendi.`;
      await pool.query(
        "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
        [mesaj, kayit.talep_eden]
      );
    }

    res.json({ message: "İşlem Başarılı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});
// 4. KULLANILAN İZİN DURUMUNU GETİR (Kullanılan + Toplam Hak)
app.get("/izinler/kullanilan/:ad_soyad", async (req, res) => {
  try {
    const { ad_soyad } = req.params;

    // 1. Kullanılan Gün Toplamı
    const kullanılanRes = await pool.query(
      "SELECT SUM(gun_sayisi) as toplam FROM izinler WHERE talep_eden = $1 AND durum LIKE 'Onaylandı%'",
      [ad_soyad]
    );

    // 2. Kullanıcının Toplam Hakkı
    const hakRes = await pool.query(
      "SELECT toplam_izin_hakki FROM kullanicilar WHERE ad_soyad = $1",
      [ad_soyad]
    );

    const kullanilan = kullanılanRes.rows[0].toplam || 0;
    // Eğer kullanıcı bulunamazsa default 14 dön
    const toplamHak =
      hakRes.rows.length > 0 ? hakRes.rows[0].toplam_izin_hakki : 14;

    res.json({
      kullanılan: parseInt(kullanilan),
      toplam_hak: parseInt(toplamHak),
    });
  } catch (err) {
    console.error(err.message);
  }
});

// ==========================================
// --- ALT GÖREV YÖNETİMİ (YENİ) ---
// ==========================================

// A. ALT GÖREVLERİ GETİR
app.get("/gorevler/:id/alt-gorevler", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM alt_gorevler WHERE gorev_id = $1 ORDER BY id ASC",
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
  }
});

// B. YENİ ALT GÖREV EKLE
app.post("/gorevler/:id/alt-gorevler", async (req, res) => {
  try {
    const { baslik, olusturan } = req.body;
    const result = await pool.query(
      "INSERT INTO alt_gorevler (gorev_id, baslik, olusturan) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, baslik, olusturan]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// C. ALT GÖREV DURUMU DEĞİŞTİR (TİK ATMA)
app.put("/alt-gorevler/:id", async (req, res) => {
  try {
    const { durum } = req.body; // true veya false
    await pool.query("UPDATE alt_gorevler SET durum = $1 WHERE id = $2", [
      durum,
      req.params.id,
    ]);
    res.json({ message: "Güncellendi" });
  } catch (err) {
    console.error(err.message);
  }
});

// D. ALT GÖREV SİL
app.delete("/alt-gorevler/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM alt_gorevler WHERE id = $1", [req.params.id]);
    res.json({ message: "Silindi" });
  } catch (err) {
    console.error(err.message);
  }
});
// ==========================================
// --- DRIVE / ARŞİV MODÜLÜ ---
// ==========================================

// 1. KLASÖR İÇERİĞİNİ GETİR (DEPARTMAN GİZLİLİĞİ + SOFT DELETE DESTEKLİ 🔒)
app.get("/drive/icerik", async (req, res) => {
  try {
    const { klasor_id, userId } = req.query;

    let klasorQuery = "";
    let dosyaQuery = "";
    let params = [];

    // KULLANICI BİLGİSİNİ ÇEK
    let userDepartman = "";
    let userRol = "";
    if (userId) {
      const u = await pool.query(
        "SELECT departman, rol FROM kullanicilar WHERE id=$1",
        [userId]
      );
      if (u.rows.length > 0) {
        userDepartman = u.rows[0].departman;
        userRol = u.rows[0].rol;
      }
    }

    if (klasor_id && klasor_id !== "null") {
      // --- ALT KLASÖRDEYİZ ---
      // Filtre yok, içeriği gör AMA silinenleri gizle
      klasorQuery =
        "SELECT * FROM klasorler WHERE ust_klasor_id = $1 AND silindi = FALSE ORDER BY ad ASC";
      dosyaQuery =
        "SELECT * FROM dosyalar WHERE klasor_id = $1 AND silindi = FALSE ORDER BY id DESC";
      params = [klasor_id];
    } else {
      // --- ANA DİZİNDEYİZ (ROOT) ---

      // Eğer Genel Müdür ise her şeyi görsün (Silinmemiş olanları)
      if (userRol === "Genel Müdür") {
        klasorQuery =
          "SELECT * FROM klasorler WHERE ust_klasor_id IS NULL AND silindi = FALSE ORDER BY ad ASC";
      } else {
        // Personel: Sadece Kendi Departmanını VEYA "Genel/Ortak" klasörleri gör (Silinmemiş olanları)
        klasorQuery = `
            SELECT * FROM klasorler 
            WHERE ust_klasor_id IS NULL 
            AND silindi = FALSE
            AND (ad = $1 OR ad ILIKE '%Genel%' OR ad ILIKE '%Ortak%') 
            ORDER BY ad ASC
          `;
        params = [userDepartman];
      }

      // Root'taki dosyalar (Silinmemiş olanlar)
      dosyaQuery =
        "SELECT * FROM dosyalar WHERE klasor_id IS NULL AND silindi = FALSE ORDER BY id DESC";
    }

    // Klasörleri Çek
    const klasorler = await pool.query(klasorQuery, params);

    // Dosyaları Çek
    let dosyalar;
    if (klasor_id && klasor_id !== "null") {
      // Alt klasördeysek params (klasor_id) kullan
      dosyalar = await pool.query(dosyaQuery, params);
    } else {
      // Ana dizindeysek params kullanma (dosyaQuery parametre içermiyor)
      dosyalar = await pool.query(dosyaQuery);
    }

    // Breadcrumb için aktif klasör adı
    let aktifKlasorAdi = "Şirket Arşivi";
    if (klasor_id && klasor_id !== "null") {
      const current = await pool.query(
        "SELECT ad FROM klasorler WHERE id = $1",
        [klasor_id]
      );
      if (current.rows.length > 0) aktifKlasorAdi = current.rows[0].ad;
    }

    res.json({
      klasorler: klasorler.rows,
      dosyalar: dosyalar.rows,
      aktifKlasorAdi: aktifKlasorAdi,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 2. YENİ KLASÖR OLUŞTUR
app.post("/drive/klasor", async (req, res) => {
  try {
    const { ad, ust_klasor_id, olusturan } = req.body;
    const pid =
      ust_klasor_id && ust_klasor_id !== "null" ? ust_klasor_id : null;

    await pool.query(
      "INSERT INTO klasorler (ad, ust_klasor_id, olusturan) VALUES ($1, $2, $3)",
      [ad, pid, olusturan]
    );
    res.json({ message: "Klasör oluşturuldu" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 3. DOSYA YÜKLE (DRIVE İÇİN ÖZEL)
app.post("/drive/dosya", upload.single("dosya"), async (req, res) => {
  try {
    const { klasor_id, yukleyen } = req.body;
    const file = req.file;

    if (!file) return res.status(400).send("Dosya yok");

    const pid = klasor_id && klasor_id !== "null" ? klasor_id : null;
    const dosyaYolu = file.filename; // İleride burası S3 URL'i olacak

    await pool.query(
      "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, klasor_id, yukleyen) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        file.originalname,
        file.filename,
        dosyaYolu,
        path.extname(file.originalname),
        file.size,
        pid,
        yukleyen,
      ]
    );

    res.json({ message: "Dosya yüklendi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 4. DOSYA ARA (Global Search)
app.get("/drive/ara", async (req, res) => {
  try {
    const { q } = req.query;
    const result = await pool.query(
      "SELECT * FROM dosyalar WHERE ad ILIKE $1 ORDER BY tarih DESC",
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
  }
});
// 5. DOSYA ADINI DEĞİŞTİR (RENAME)
app.put("/drive/dosya/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { yeniAd } = req.body; // Örn: "Yeni Rapor Adı"

    // 1. Dosyanın mevcut uzantısını korumak için önce veriyi çekelim
    const dosya = await pool.query(
      "SELECT ad, uzanti FROM dosyalar WHERE id = $1",
      [id]
    );

    if (dosya.rows.length === 0) {
      return res.status(404).json({ error: "Dosya bulunamadı" });
    }

    const mevcutUzanti = dosya.rows[0].uzanti;
    let finalAd = yeniAd;

    // Kullanıcı uzantıyı yazmadıysa biz ekleyelim ki dosya bozuk görünmesin
    if (!finalAd.endsWith(mevcutUzanti)) {
      finalAd += mevcutUzanti;
    }

    // 2. Sadece Veritabanındaki ismini güncelle (Fiziksel isme dokunma)
    await pool.query("UPDATE dosyalar SET ad = $1 WHERE id = $2", [
      finalAd,
      id,
    ]);

    res.json({ message: "Dosya adı güncellendi", yeniAd: finalAd });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});
// 6. DOSYA SİL (SOFT DELETE - ÇÖP KUTUSUNA GÖNDER)
app.delete("/drive/dosya/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE dosyalar SET silindi = TRUE WHERE id = $1", [id]);
    res.json({ message: "Dosya çöp kutusuna taşındı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 7. DOSYA TAŞIMA (Sürükle-Bırak İçin)
app.put("/drive/tasi", async (req, res) => {
  try {
    const { dosyaId, hedefKlasorId } = req.body;

    // Klasör ID null ise (Ana Dizin) veya sayı ise güncelle
    await pool.query("UPDATE dosyalar SET klasor_id = $1 WHERE id = $2", [
      hedefKlasorId,
      dosyaId,
    ]);

    res.json({ message: "Dosya taşındı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Taşıma hatası");
  }
});
// 8. DOSYA KOPYALA (Copy & Paste İçin)
app.post("/drive/kopyala", async (req, res) => {
  try {
    const { dosyaId, hedefKlasorId } = req.body;

    // 1. Kaynak dosyayı bul
    const kaynak = await pool.query("SELECT * FROM dosyalar WHERE id = $1", [
      dosyaId,
    ]);
    if (kaynak.rows.length === 0)
      return res.status(404).json({ error: "Dosya yok" });

    const dosya = kaynak.rows[0];

    // 2. Yeni fiziksel isim üret (Çakışmayı önlemek için timestamp ekle)
    const yeniFizikselAd = `copy_${Date.now()}_${dosya.fiziksel_ad}`;
    const kaynakYol = path.join(__dirname, "uploads", dosya.fiziksel_ad);
    const hedefYol = path.join(__dirname, "uploads", yeniFizikselAd);

    // 3. Fiziksel dosyayı kopyala (fs modülü ile)
    if (fs.existsSync(kaynakYol)) {
      fs.copyFileSync(kaynakYol, hedefYol);
    } else {
      return res.status(500).json({ error: "Fiziksel dosya bulunamadı" });
    }

    // 4. Veritabanına yeni kayıt ekle
    // Not: Adının sonuna "- Kopya" ekleyebiliriz veya aynı bırakabiliriz.
    const yeniAd = `${path.parse(dosya.ad).name} - Kopya${dosya.uzanti}`;

    await pool.query(
      "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, yukleyen, klasor_id, tarih) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
      [
        yeniAd,
        yeniFizikselAd,
        yeniFizikselAd,
        dosya.uzanti,
        dosya.boyut,
        dosya.yukleyen,
        hedefKlasorId,
      ]
    );

    res.json({ message: "Dosya kopyalandı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Kopyalama hatası");
  }
});
// 9. KLASÖR SİL (SOFT DELETE)
app.delete("/drive/klasor/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Klasörü sildiğinde içindekiler veritabanında "silindi" işaretlenmese bile,
    // hiyerarşik olarak erişilemeyeceği için gizlenmiş olur.
    // Ancak temizlik için recursive (iç içe) silme yapılabilir, şimdilik basit tutalım:
    await pool.query("UPDATE klasorler SET silindi = TRUE WHERE id = $1", [id]);
    res.json({ message: "Klasör çöp kutusuna taşındı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});
// 10. ÇÖP KUTUSUNU GETİR
app.get("/drive/cop-kutusu", async (req, res) => {
  try {
    const { userId } = req.query;
    // Burada güvenlik filtresi (departman vb.) uygulanabilir. Şimdilik basitleştirilmiş:
    const klasorler = await pool.query(
      "SELECT * FROM klasorler WHERE silindi = TRUE ORDER BY id DESC"
    );
    const dosyalar = await pool.query(
      "SELECT * FROM dosyalar WHERE silindi = TRUE ORDER BY id DESC"
    );

    res.json({ klasorler: klasorler.rows, dosyalar: dosyalar.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 11. GERİ YÜKLE (RESTORE)
app.put("/drive/geri-yukle", async (req, res) => {
  try {
    const { id, tip } = req.body; // tip: 'dosya' veya 'klasor'

    if (tip === "dosya") {
      await pool.query("UPDATE dosyalar SET silindi = FALSE WHERE id = $1", [
        id,
      ]);
    } else {
      await pool.query("UPDATE klasorler SET silindi = FALSE WHERE id = $1", [
        id,
      ]);
    }
    res.json({ message: "Geri yüklendi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 12. KALICI SİL (HARD DELETE)
app.delete("/drive/kalici-sil", async (req, res) => {
  try {
    const { id, tip } = req.body; // tip: 'dosya' veya 'klasor'

    if (tip === "dosya") {
      // Fiziksel silme de yapılmalı
      const dosya = await pool.query(
        "SELECT fiziksel_ad FROM dosyalar WHERE id = $1",
        [id]
      );
      if (dosya.rows.length > 0) {
        const yol = path.join(__dirname, "uploads", dosya.rows[0].fiziksel_ad);
        if (fs.existsSync(yol)) fs.unlinkSync(yol);
      }
      await pool.query("DELETE FROM dosyalar WHERE id = $1", [id]);
    } else {
      // Klasör kalıcı silinirse içindeki her şey de silinmeli (Cascade)
      // Şimdilik sadece kaydı siliyoruz
      await pool.query("DELETE FROM klasorler WHERE id = $1", [id]);
    }
    res.json({ message: "Kalıcı olarak silindi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 13. KLASÖR TAŞIMA (Sürükle-Bırak İçin)
app.put("/drive/klasor-tasi", async (req, res) => {
  try {
    const { klasorId, hedefKlasorId } = req.body;
    if (parseInt(klasorId) === parseInt(hedefKlasorId))
      return res.status(400).send("Kendine taşıyamazsın");

    await pool.query("UPDATE klasorler SET ust_klasor_id = $1 WHERE id = $2", [
      hedefKlasorId,
      klasorId,
    ]);
    res.json({ message: "Klasör taşındı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

app.listen(3000, () => {
  console.log("SERVER ÇALIŞIYOR: http://localhost:3000");
});
