const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { upload } = require("../config/upload");
const path = require("path");

// --- YARDIMCI FONKSİYON: Klasör Zinciri Oluştur ---
// ARTIK ID ALIYOR (olusturan_id)
async function klasorHiyerarsisiOlustur(klasorAdlari, olusturan_id) {
  let ustKlasorId = null;
  for (const ad of klasorAdlari) {
    if (!ad) continue;

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
      // YOKSA OLUŞTUR (ID İLE - DÜZELTİLDİ)
      // Eğer olusturan_id null gelirse varsayılan 1 (Genel Müdür) ata
      const creatorId = olusturan_id ? parseInt(olusturan_id) : 1;

      const yeni = await pool.query(
        "INSERT INTO klasorler (ad, ust_klasor_id, olusturan_id) VALUES ($1, $2, $3) RETURNING id",
        [ad, ustKlasorId, creatorId]
      );
      ustKlasorId = yeni.rows[0].id;
    }
  }
  return ustKlasorId;
}

// ==========================================
// PROJE ROTALARI (EN ÜSTTE)
// ==========================================

router.get("/projeler", async (req, res) => {
  try {
    const result = await pool.query(`
        SELECT p.*, k.ad_soyad as olusturan_adi 
        FROM projeler p 
        LEFT JOIN kullanicilar k ON p.olusturan_id = k.id 
        ORDER BY p.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

router.post("/projeler", async (req, res) => {
  try {
    const { ad, departman, baslangic_tarihi, bitis_tarihi, olusturan_id } =
      req.body;
    const result = await pool.query(
      "INSERT INTO projeler (ad, departman, baslangic_tarihi, bitis_tarihi, olusturan_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [ad, departman, baslangic_tarihi, bitis_tarihi, olusturan_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

router.delete("/projeler/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE gorevler SET proje_id = NULL WHERE proje_id = $1",
      [id]
    );
    await pool.query("DELETE FROM projeler WHERE id = $1", [id]);
    res.json({ message: "Proje silindi" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

// ==========================================
// GÖREV ROTALARI
// ==========================================

// 1. GÖREV LİSTELEME (Avatar Eklendi)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.*, p.ad as proje_adi, k.ad_soyad as olusturan_adi, k.avatar as olusturan_avatar 
      FROM gorevler g
      LEFT JOIN projeler p ON g.proje_id = p.id
      LEFT JOIN kullanicilar k ON g.olusturan_id = k.id
      ORDER BY g.id ASC
    `);

    // NOT: Atananların avatarını tek sorguda almak zor olduğu için
    // Frontend tarafında kullanıcı listesinden eşleştirmek daha performanslıdır.
    // Ancak burada 'olusturan' avatarını ekledik.

    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Hata");
  }
});

// 2. TEK GÖREV GETİR (DOSYALARI DA GETİRİYORUZ! 📁)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: "Geçersiz ID" });

    // Görev Bilgisi
    const gorevRes = await pool.query(
      `SELECT g.*, p.ad as proje_adi FROM gorevler g LEFT JOIN projeler p ON g.proje_id = p.id WHERE g.id = $1`,
      [id]
    );
    if (gorevRes.rows.length === 0)
      return res.status(404).json({ error: "Görev bulunamadı" });

    // Dosyaları Getir (#ID - formatına göre)
    const dosyaRes = await pool.query(
      "SELECT * FROM dosyalar WHERE ad LIKE $1 AND silindi = FALSE",
      [`#${id} -%`]
    );

    // Görev objesine dosyaları ekle
    const gorev = {
      ...gorevRes.rows[0],
      dosyalar: dosyaRes.rows, // <-- YENİ EKLENEN ALAN
    };

    res.json(gorev);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

// 3. GÖREV EKLEME (SEÇENEK A: DÜZ YAPI - ÇOKLU YÜKLEME)
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
      olusturan_id,
    } = req.body;

    // Görevi Kaydet
    const result = await pool.query(
      "INSERT INTO gorevler (baslik, aciklama, oncelik, tarih, durum, atananlar, gozlemciler, proje_id, tekrar_tipi, olusturan_id) VALUES ($1, $2, $3, $4, 'Bekliyor', $5, $6, $7, $8, $9) RETURNING *",
      [
        baslik,
        aciklama,
        oncelik,
        tarih,
        JSON.parse(atananlar || "[]"),
        JSON.parse(gozlemciler || "[]"),
        proje_id || null,
        tekrar_tipi || "Tek Seferlik",
        olusturan_id,
      ]
    );
    const yeniGorevId = result.rows[0].id;

    // DRIVE İŞLEMLERİ
    if (req.files && req.files.length > 0) {
      const userId = olusturan_id ? parseInt(olusturan_id) : 1;

      // 1. Ana Rota: [Departman] > [Proje]
      let yol = ["Genel Görevler"];
      if (proje_id) {
        const prj = await pool.query(
          "SELECT ad, departman FROM projeler WHERE id=$1",
          [proje_id]
        );
        if (prj.rows.length > 0) {
          yol = [prj.rows[0].departman, prj.rows[0].ad];
        }
      }

      // 2. Klasör Zincirini Oluştur
      const hedefKlasorId = await klasorHiyerarsisiOlustur(yol, userId);

      // 3. Tüm Dosyaları Kaydet (#ID - Prefix ile)
      // Artık "Görev Adı" ile klasör AÇMIYORUZ. Direkt proje klasörüne atıyoruz.
      for (const file of req.files) {
        const finalAd = `#${yeniGorevId} - ${file.originalname}`;

        await pool.query(
          "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, yukleyen_id, klasor_id, tarih) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
          [
            finalAd,
            file.filename,
            file.filename,
            path.extname(file.originalname),
            file.size,
            userId,
            hedefKlasorId,
          ]
        );
      }

      // Görevin dosya ikonunu güncelle
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

// 4. GÖREV GÜNCELLEME (DOSYA DESTEĞİ EKLENDİ! 🔄)
router.put("/:id", upload.array("dosyalar"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      baslik,
      aciklama,
      oncelik,
      durum,
      proje_id,
      atananlar,
      olusturan_id,
    } = req.body;

    await pool.query(
      "UPDATE gorevler SET baslik=$1, aciklama=$2, oncelik=$3, durum=$4, proje_id=$5, atananlar=$6 WHERE id=$7",
      [
        baslik,
        aciklama,
        oncelik,
        durum,
        proje_id || null,
        JSON.parse(atananlar || "[]"),
        id,
      ]
    );

    // YENİ DOSYALAR VARSA DRIVE'A EKLE
    if (req.files && req.files.length > 0) {
      const userId = olusturan_id ? parseInt(olusturan_id) : 1; // Güncelleyen kişi

      // Yol bulma (Aynı mantık)
      let yol = ["Genel Görevler"];
      if (proje_id) {
        const prj = await pool.query(
          "SELECT ad, departman FROM projeler WHERE id=$1",
          [proje_id]
        );
        if (prj.rows.length > 0) yol = [prj.rows[0].departman, prj.rows[0].ad];
      }
      const hedefKlasorId = await klasorHiyerarsisiOlustur(yol, userId);

      for (const file of req.files) {
        const finalAd = `#${id} - ${file.originalname}`;
        await pool.query(
          "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, yukleyen_id, klasor_id, tarih) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
          [
            finalAd,
            file.filename,
            file.filename,
            path.extname(file.originalname),
            file.size,
            userId,
            hedefKlasorId,
          ]
        );
      }
      await pool.query("UPDATE gorevler SET dosya_yolu = 'VAR' WHERE id = $1", [
        id,
      ]);
    }

    res.json({ message: "Güncellendi" });
  } catch (e) {
    console.error(e);
    res.status(500).send("Hata");
  }
});

// 5. GÖREV SİLME
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE klasorler SET silindi = TRUE WHERE ad LIKE $1", [
      `#${id} -%`,
    ]);
    await pool.query("UPDATE dosyalar SET silindi = TRUE WHERE ad LIKE $1", [
      `#${id} -%`,
    ]);
    await pool.query("DELETE FROM gorevler WHERE id = $1", [id]);
    res.json({ message: "Görev silindi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Silme hatası" });
  }
});

// 6. YORUMLAR (Avatar Eklendi)
router.get("/:id/yorumlar", async (req, res) => {
  try {
    const r = await pool.query(
      `
        SELECT y.*, k.ad_soyad as yazan_kisi_adi, k.avatar as yazan_kisi_avatar
        FROM yorumlar y
        LEFT JOIN kullanicilar k ON y.yazan_kisi_id = k.id
        WHERE y.gorev_id = $1 ORDER BY y.tarih ASC
    `,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
  }
});

router.post("/:id/yorumlar", async (req, res) => {
  try {
    const { yazan_kisi_id, mesaj } = req.body;
    const r = await pool.query(
      "INSERT INTO yorumlar (gorev_id, yazan_kisi_id, mesaj) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, yazan_kisi_id, mesaj]
    );

    // Bildirim için ismi bul
    const user = await pool.query(
      "SELECT ad_soyad FROM kullanicilar WHERE id=$1",
      [yazan_kisi_id]
    );
    const adSoyad = user.rows[0]?.ad_soyad || "Biri";

    await pool.query(
      "INSERT INTO bildirimler (mesaj, kime, gorev_id) VALUES ($1, $2, $3)",
      [`💬 ${adSoyad} yorum yaptı`, "İlgililer", req.params.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
  }
});

// 7. ALT GÖREVLER (DÜZELTİLDİ: ID İLE)
router.get("/:id/alt-gorevler", async (req, res) => {
  try {
    const r = await pool.query(
      `
        SELECT a.*, k.ad_soyad as olusturan_adi
        FROM alt_gorevler a
        LEFT JOIN kullanicilar k ON a.olusturan_id = k.id
        WHERE a.gorev_id = $1 ORDER BY a.id ASC
    `,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
  }
});

router.post("/:id/alt-gorevler", async (req, res) => {
  try {
    const { baslik, olusturan_id } = req.body;
    const r = await pool.query(
      "INSERT INTO alt_gorevler (gorev_id, baslik, olusturan_id) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, baslik, olusturan_id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
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
