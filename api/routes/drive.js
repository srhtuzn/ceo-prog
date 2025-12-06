const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// -----------------------------------------
// MULTER AYARI
// -----------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});
const upload = multer({ storage });

// ==========================================
// 1. İÇERİK GETİR (JOIN ile İsimleri Çekme - Normalizasyon)
// URL: GET /drive/icerik
// ==========================================
router.get("/icerik", async (req, res) => {
  try {
    const { klasor_id, userId } = req.query;

    const klasorQuery =
      klasor_id && klasor_id !== "null"
        ? `SELECT k.*, u.ad_soyad as olusturan_adi 
           FROM klasorler k 
           LEFT JOIN kullanicilar u ON k.olusturan_id = u.id 
           WHERE k.ust_klasor_id = $1 AND k.silindi = FALSE ORDER BY k.ad ASC`
        : `SELECT k.*, u.ad_soyad as olusturan_adi 
           FROM klasorler k 
           LEFT JOIN kullanicilar u ON k.olusturan_id = u.id 
           WHERE k.ust_klasor_id IS NULL AND k.silindi = FALSE ORDER BY k.ad ASC`;

    const dosyaQuery =
      klasor_id && klasor_id !== "null"
        ? `SELECT d.*, u.ad_soyad as yukleyen_adi 
           FROM dosyalar d 
           LEFT JOIN kullanicilar u ON d.yukleyen_id = u.id 
           WHERE d.klasor_id = $1 AND d.silindi = FALSE ORDER BY d.id DESC`
        : `SELECT d.*, u.ad_soyad as yukleyen_adi 
           FROM dosyalar d 
           LEFT JOIN kullanicilar u ON d.yukleyen_id = u.id 
           WHERE d.klasor_id IS NULL AND d.silindi = FALSE ORDER BY d.id DESC`;

    const params = klasor_id && klasor_id !== "null" ? [klasor_id] : [];

    const [klasorler, dosyalar] = await Promise.all([
      pool.query(klasorQuery, params),
      pool.query(dosyaQuery, params),
    ]);

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
      aktifKlasorAdi,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Drive içeriği getirilemedi");
  }
});

// ==========================================
// 2. DRIVE ARAMA (GELİŞMİŞ - JOIN EKLİ)
// URL: GET /drive/ara?q=...
// ==========================================
router.get("/ara", async (req, res) => {
  try {
    const { q, tur, baslangic, bitis } = req.query;

    let sql = `SELECT d.*, u.ad_soyad as yukleyen_adi 
                 FROM dosyalar d 
                 LEFT JOIN kullanicilar u ON d.yukleyen_id = u.id 
                 WHERE d.silindi = FALSE`;
    let params = [];
    let paramCounter = 1;

    if (q) {
      sql += ` AND d.ad ILIKE $${paramCounter}`;
      params.push(`%${q}%`);
      paramCounter++;
    }
    if (tur) {
      if (tur === "resim")
        sql += ` AND (d.uzanti ILIKE '.jpg' OR d.uzanti ILIKE '.png' OR d.uzanti ILIKE '.jpeg')`;
      else if (tur === "dokuman")
        sql += ` AND (d.uzanti ILIKE '.pdf' OR d.uzanti ILIKE '.docx' OR d.uzanti ILIKE '.txt')`;
      else if (tur === "excel")
        sql += ` AND (d.uzanti ILIKE '.xlsx' OR d.uzanti ILIKE '.csv')`;
    }
    if (baslangic && bitis) {
      sql += ` AND d.tarih BETWEEN $${paramCounter} AND $${paramCounter + 1}`;
      params.push(baslangic, bitis);
      paramCounter += 2;
    }
    sql += " ORDER BY d.id DESC";
    const dosyaSonuc = await pool.query(sql, params);

    let klasorSonuc = { rows: [] };
    if (q && !tur && !baslangic) {
      klasorSonuc = await pool.query(
        `
            SELECT k.*, u.ad_soyad as olusturan_adi 
            FROM klasorler k 
            LEFT JOIN kullanicilar u ON k.olusturan_id = u.id
            WHERE k.ad ILIKE $1 AND k.silindi = FALSE`,
        [`%${q}%`]
      );
    }

    const sonuc = [
      ...klasorSonuc.rows.map((k) => ({ ...k, tip: "klasor" })),
      ...dosyaSonuc.rows.map((d) => ({ ...d, tip: "dosya" })),
    ];
    res.json(sonuc);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Arama hatası");
  }
});

// ==========================================
// 3. İSTATİSTİKLER
// URL: GET /drive/istatistik
// ==========================================
router.get("/istatistik", async (req, res) => {
  try {
    const istatistik = await pool.query(`
            SELECT 
                COUNT(*) as toplam_dosya,
                SUM(boyut) as toplam_boyut,
                COUNT(CASE WHEN silindi = TRUE THEN 1 END) as copteki_dosya
            FROM dosyalar
        `);
    res.json(istatistik.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// ==========================================
// 4. KLASÖR OLUŞTUR (ID Kaydet)
// ==========================================
router.post("/klasor", async (req, res) => {
  try {
    const { ad, ust_klasor_id, olusturan } = req.body; // Frontend'den ID gelmeli (olusturan)
    const pid =
      ust_klasor_id && ust_klasor_id !== "null" ? ust_klasor_id : null;

    // Eğer olusturan (ID) gelmezse varsayılan 1 (Genel Müdür) ata
    const creatorId = olusturan ? parseInt(olusturan) : 1;

    await pool.query(
      "INSERT INTO klasorler (ad, ust_klasor_id, olusturan_id) VALUES ($1, $2, $3)",
      [ad, pid, creatorId]
    );

    res.json({ message: "Klasör oluşturuldu" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Klasör oluşturulamadı");
  }
});

// ==========================================
// 5. DOSYA YÜKLE (ID Kaydet)
// ==========================================
router.post("/dosya", upload.single("dosya"), async (req, res) => {
  try {
    const { klasor_id, yukleyen } = req.body; // Frontend'den ID gelmeli (yukleyen)
    const file = req.file;

    if (!file) return res.status(400).send("Dosya yok");

    const pid = klasor_id && klasor_id !== "null" ? klasor_id : null;
    const uploaderId = yukleyen ? parseInt(yukleyen) : 1;

    await pool.query(
      "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, klasor_id, yukleyen_id, tarih) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
      [
        file.originalname,
        file.filename,
        file.filename,
        path.extname(file.originalname),
        file.size,
        pid,
        uploaderId,
      ]
    );

    res.json({ message: "Dosya yüklendi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Dosya yüklenemedi");
  }
});

// ==========================================
// 6. İŞLEMLER (İsim Değiştir, Sil, Taşı, Kopyala)
// ==========================================
router.put("/dosya/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { yeniAd } = req.body;
    await pool.query("UPDATE dosyalar SET ad = $1 WHERE id = $2", [yeniAd, id]);
    res.json({ message: "Güncellendi" });
  } catch (err) {
    res.status(500).send("Hata");
  }
});

router.delete("/dosya/:id", async (req, res) => {
  try {
    await pool.query("UPDATE dosyalar SET silindi = TRUE WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ message: "Çöp kutusuna taşındı" });
  } catch (err) {
    res.status(500).send("Hata");
  }
});

router.delete("/klasor/:id", async (req, res) => {
  try {
    await pool.query("UPDATE klasorler SET silindi = TRUE WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ message: "Çöp kutusuna taşındı" });
  } catch (err) {
    res.status(500).send("Hata");
  }
});

router.put("/tasi", async (req, res) => {
  try {
    const { dosyaId, hedefKlasorId } = req.body;
    await pool.query("UPDATE dosyalar SET klasor_id = $1 WHERE id = $2", [
      hedefKlasorId,
      dosyaId,
    ]);
    res.json({ message: "Taşındı" });
  } catch (err) {
    res.status(500).send("Hata");
  }
});

router.post("/kopyala", async (req, res) => {
  try {
    const { dosyaId, hedefKlasorId } = req.body;
    const kaynak = await pool.query("SELECT * FROM dosyalar WHERE id = $1", [
      dosyaId,
    ]);
    if (kaynak.rows.length === 0)
      return res.status(404).json({ error: "Dosya yok" });

    const dosya = kaynak.rows[0];
    const yeniFizikselAd = `copy_${Date.now()}_${dosya.fiziksel_ad}`;

    const kaynakYol = path.join(__dirname, "../../uploads", dosya.fiziksel_ad);
    const hedefYol = path.join(__dirname, "../../uploads", yeniFizikselAd);

    try {
      if (fs.existsSync(kaynakYol)) {
        fs.copyFileSync(kaynakYol, hedefYol);
      } else {
        return res.status(500).json({ error: "Fiziksel dosya bulunamadı" });
      }
    } catch (fsError) {
      console.error("Dosya kopyalama hatası:", fsError);
      return res.status(500).json({ error: "Disk yazma hatası" });
    }

    const yeniAd = `${path.parse(dosya.ad).name} - Kopya${dosya.uzanti}`;

    // Kopyalarken 'yukleyen_id'yi de taşıyoruz veya oturum açan kişi yapabiliriz.
    // Şimdilik kaynak dosyanın sahibini kopyalıyoruz.
    await pool.query(
      "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, yukleyen_id, klasor_id, tarih) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
      [
        yeniAd,
        yeniFizikselAd,
        yeniFizikselAd,
        dosya.uzanti,
        dosya.boyut,
        dosya.yukleyen_id,
        hedefKlasorId,
      ]
    );

    res.json({ message: "Kopyalandı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Kopyalama hatası");
  }
});

// ==========================================
// 7. ÇÖP KUTUSU YÖNETİMİ
// ==========================================
router.get("/cop-kutusu", async (req, res) => {
  try {
    const klasorler = await pool.query(
      "SELECT * FROM klasorler WHERE silindi = TRUE ORDER BY id DESC"
    );
    const dosyalar = await pool.query(
      "SELECT * FROM dosyalar WHERE silindi = TRUE ORDER BY id DESC"
    );
    res.json({ klasorler: klasorler.rows, dosyalar: dosyalar.rows });
  } catch (err) {
    res.status(500).send("Hata");
  }
});

router.put("/geri-yukle", async (req, res) => {
  try {
    const { id, tip } = req.body;
    const tablo = tip === "dosya" ? "dosyalar" : "klasorler";
    await pool.query(`UPDATE ${tablo} SET silindi = FALSE WHERE id = $1`, [id]);
    res.json({ message: "Geri yüklendi" });
  } catch (err) {
    res.status(500).send("Hata");
  }
});

router.delete("/kalici-sil", async (req, res) => {
  try {
    const { id, tip } = req.body;
    if (tip === "dosya") {
      const dosya = await pool.query(
        "SELECT fiziksel_ad FROM dosyalar WHERE id = $1",
        [id]
      );
      if (dosya.rows.length > 0) {
        const yol = path.join(
          __dirname,
          "../../uploads",
          dosya.rows[0].fiziksel_ad
        );
        if (fs.existsSync(yol)) fs.unlinkSync(yol);
      }
      await pool.query("DELETE FROM dosyalar WHERE id = $1", [id]);
    } else {
      await pool.query("DELETE FROM klasorler WHERE id = $1", [id]);
    }
    res.json({ message: "Kalıcı olarak silindi" });
  } catch (err) {
    res.status(500).send("Hata");
  }
});

router.delete("/copu-bosalt", async (req, res) => {
  try {
    const silinecekler = await pool.query(
      "SELECT fiziksel_ad FROM dosyalar WHERE silindi = TRUE"
    );
    silinecekler.rows.forEach((file) => {
      const yol = path.join(__dirname, "../../uploads", file.fiziksel_ad);
      if (fs.existsSync(yol)) fs.unlinkSync(yol);
    });
    await pool.query("DELETE FROM dosyalar WHERE silindi = TRUE");
    await pool.query("DELETE FROM klasorler WHERE silindi = TRUE");
    res.json({ message: "Çöp kutusu tamamen temizlendi." });
  } catch (err) {
    res.status(500).send("Temizlik yapılamadı");
  }
});

router.delete("/otomatik-temizle", async (req, res) => {
  try {
    const eskiler = await pool.query(
      "SELECT fiziksel_ad FROM dosyalar WHERE silindi = TRUE AND tarih < NOW() - INTERVAL '30 days'"
    );
    eskiler.rows.forEach((file) => {
      const yol = path.join(__dirname, "../../uploads", file.fiziksel_ad);
      if (fs.existsSync(yol)) fs.unlinkSync(yol);
    });
    await pool.query(
      "DELETE FROM dosyalar WHERE silindi = TRUE AND tarih < NOW() - INTERVAL '30 days'"
    );
    res.json({ message: `${eskiler.rows.length} adet eski dosya temizlendi.` });
  } catch (err) {
    res.status(500).send("Otomatik temizlik hatası");
  }
});

module.exports = router;
