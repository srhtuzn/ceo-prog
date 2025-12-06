// api/routes/gorevler.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { upload } = require("../config/upload");
const path = require("path");

// --- YARDIMCI FONKSİYON: Klasör Zinciri Oluştur ---
// Verilen isimlerde (örn: ["Bilgi İşlem", "Web Sitesi Yenileme"]) klasörleri sırasıyla bulur veya oluşturur.
async function klasorHiyerarsisiOlustur(klasorAdlari, olusturan) {
  let ustKlasorId = null;
  for (const ad of klasorAdlari) {
    if (!ad) continue;

    // Klasör var mı kontrol et (Silinmemiş olanlar)
    let sorgu = "SELECT id FROM klasorler WHERE ad = $1 AND silindi = FALSE";
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
      // Yoksa oluştur
      const yeni = await pool.query(
        "INSERT INTO klasorler (ad, ust_klasor_id, olusturan) VALUES ($1, $2, $3) RETURNING id",
        [ad, ustKlasorId, olusturan]
      );
      ustKlasorId = yeni.rows[0].id;
    }
  }
  return ustKlasorId;
}

// ==========================================
// ÖNEMLİ: PROJE ROTALARI (EN ÜSTTE OLMALI)
// ==========================================

// PROJE LİSTELE
router.get("/projeler", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM projeler ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// PROJE EKLE
router.post("/projeler", async (req, res) => {
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
    res.status(500).send("Hata");
  }
});

// PROJE SİL
router.delete("/projeler/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Projeye bağlı görevleri serbest bırak
    await pool.query(
      "UPDATE gorevler SET proje_id = NULL WHERE proje_id = $1",
      [id]
    );
    // Projeyi sil
    await pool.query("DELETE FROM projeler WHERE id = $1", [id]);
    res.json({ message: "Proje silindi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// ==========================================
// GÖREV ROTALARI
// ==========================================

// 1. GÖREV LİSTELEME
router.get("/", async (req, res) => {
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
    res.status(500).send("Hata");
  }
});

// 2. TEK GÖREV GETİR
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // ID kontrolü (Sayısal değilse hata vermemesi için)
    if (isNaN(id)) return res.status(400).json({ error: "Geçersiz ID" });

    const result = await pool.query(
      `SELECT g.*, p.ad as proje_adi FROM gorevler g LEFT JOIN projeler p ON g.proje_id = p.id WHERE g.id = $1`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Görev bulunamadı" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 3. GÖREV EKLEME (GELİŞMİŞ KLASÖRLEME MANTIĞI) 🧠
router.post("/", upload.array("dosyalar"), async (req, res) => {
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

    // 1. Görevi Kaydet
    const result = await pool.query(
      "INSERT INTO gorevler (baslik, aciklama, oncelik, tarih, durum, atananlar, gozlemciler, proje_id, tekrar_tipi) VALUES ($1, $2, $3, $4, 'Bekliyor', $5, $6, $7, $8) RETURNING *",
      [
        baslik,
        aciklama,
        oncelik,
        tarih,
        JSON.parse(atananlar || "[]"),
        JSON.parse(gozlemciler || "[]"),
        proje_id || null,
        tekrar_tipi || "Tek Seferlik",
      ]
    );
    const yeniGorevId = result.rows[0].id;

    // 2. DRIVE ENTEGRASYONU
    if (req.files && req.files.length > 0) {
      const olusturan = "Sistem";
      let hedefKlasorId = null;

      // A. Ana Rotayı Belirle: [Departman] > [Proje]
      let yol = ["Genel Görevler"]; // Varsayılan
      if (proje_id) {
        const prj = await pool.query(
          "SELECT ad, departman FROM projeler WHERE id=$1",
          [proje_id]
        );
        if (prj.rows.length > 0) {
          yol = [prj.rows[0].departman, prj.rows[0].ad];
        }
      }

      // Bu klasör zincirini oluştur veya bul
      const projeKlasorId = await klasorHiyerarsisiOlustur(yol, olusturan);
      hedefKlasorId = projeKlasorId;

      // B. Dosya Sayısına Göre Karar Ver
      // SENARYO 1: Birden fazla dosya varsa -> Görev için özel klasör aç
      if (req.files.length > 1) {
        const gorevKlasorAdi = `#${yeniGorevId} - ${baslik}`;
        const klasorRes = await pool.query(
          "INSERT INTO klasorler (ad, ust_klasor_id, olusturan) VALUES ($1, $2, $3) RETURNING id",
          [gorevKlasorAdi, projeKlasorId, olusturan]
        );
        hedefKlasorId = klasorRes.rows[0].id;
      }
      // SENARYO 2: Tek dosya varsa -> Direkt proje klasörüne at (hedefKlasorId değişmez)

      // C. Dosyaları Kaydet
      for (const file of req.files) {
        let finalAd = file.originalname;

        // Tek dosya ise, karışmaması için dosya adına ID ekle
        if (req.files.length === 1) {
          finalAd = `#${yeniGorevId} - ${file.originalname}`;
        }

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

      // Görev kaydını güncelle (Dosya var ikonu çıksın diye)
      const dosyaYoluStr =
        req.files.length > 1 ? "COKLU_DOSYA" : req.files[0].filename;
      await pool.query("UPDATE gorevler SET dosya_yolu = $1 WHERE id = $2", [
        dosyaYoluStr,
        yeniGorevId,
      ]);
      result.rows[0].dosya_yolu = dosyaYoluStr;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GÖREV EKLEME HATASI:", err.message);
    res.status(500).send(err.message);
  }
});

// 4. GÖREV GÜNCELLEME
router.put("/:id", upload.array("dosyalar"), async (req, res) => {
  try {
    const { id } = req.params;
    const { baslik, aciklama, oncelik, durum, proje_id } = req.body;

    await pool.query(
      "UPDATE gorevler SET baslik=$1, aciklama=$2, oncelik=$3, durum=$4, proje_id=$5 WHERE id=$6",
      [baslik, aciklama, oncelik, durum, proje_id || null, id]
    );

    // Not: Güncelleme sırasında yeni dosya eklenirse, yukarıdaki 'POST' mantığının aynısı
    // buraya da eklenebilir. Şimdilik sadelik adına sadece metin güncelliyoruz.
    // İstenirse burası genişletilebilir.

    res.json({ message: "Güncellendi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 5. GÖREV SİLME (DRIVE TEMİZLİĞİ EKLENDİ 🧹)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // A. Görev Klasörünü Çöpe At (#ID - Başlık formatında olanlar)
    await pool.query("UPDATE klasorler SET silindi = TRUE WHERE ad LIKE $1", [
      `#${id} -%`,
    ]);

    // B. Tekil Dosyaları Çöpe At (#ID - DosyaAdı formatında olanlar)
    await pool.query("UPDATE dosyalar SET silindi = TRUE WHERE ad LIKE $1", [
      `#${id} -%`,
    ]);

    // C. Görevi Sil
    await pool.query("DELETE FROM gorevler WHERE id = $1", [id]);

    res.json({ message: "Görev ve dosyaları silindi (Çöp kutusuna taşındı)" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Silme hatası" });
  }
});

// ==========================================
// DİĞERLERİ (Yorum, Alt Görev)
// ==========================================

router.get("/:id/yorumlar", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM yorumlar WHERE gorev_id = $1 ORDER BY tarih ASC",
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
  }
});

router.post("/:id/yorumlar", async (req, res) => {
  try {
    const { yazan_kisi, mesaj } = req.body;
    const r = await pool.query(
      "INSERT INTO yorumlar (gorev_id, yazan_kisi, mesaj) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, yazan_kisi, mesaj]
    );

    // Bildirim
    let bildirim = `💬 ${yazan_kisi} bir yorum yazdı.`;
    if (mesaj.includes("@")) bildirim = `📣 ${yazan_kisi} senden bahsetti!`;
    await pool.query(
      "INSERT INTO bildirimler (mesaj, kime, gorev_id) VALUES ($1, $2, $3)",
      [bildirim, "İlgililer", req.params.id]
    );

    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
  }
});

router.get("/:id/alt-gorevler", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM alt_gorevler WHERE gorev_id = $1 ORDER BY id ASC",
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
  }
});

router.post("/:id/alt-gorevler", async (req, res) => {
  try {
    const { baslik, olusturan } = req.body;
    const r = await pool.query(
      "INSERT INTO alt_gorevler (gorev_id, baslik, olusturan) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, baslik, olusturan]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
  }
});

router.put("/alt-gorevler/:id", async (req, res) => {
  try {
    await pool.query("UPDATE alt_gorevler SET durum = $1 WHERE id = $2", [
      req.body.durum,
      req.params.id,
    ]);
    res.json({ message: "Ok" });
  } catch (err) {
    console.error(err);
  }
});

router.delete("/alt-gorevler/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM alt_gorevler WHERE id = $1", [req.params.id]);
    res.json({ message: "Silindi" });
  } catch (err) {
    console.error(err);
  }
});

module.exports = router;
