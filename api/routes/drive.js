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
// 1. İÇERİK GETİR (Filtreleme ve Hiyerarşi)
// URL: GET /drive/icerik
// ==========================================
router.get("/icerik", async (req, res) => {
  try {
    const { klasor_id, userId } = req.query;

    // Güvenlik ve Yetki kontrolleri burada genişletilebilir.
    // Şimdilik temel mantık: Silinmemişleri getir.

    const klasorQuery =
      klasor_id && klasor_id !== "null"
        ? "SELECT * FROM klasorler WHERE ust_klasor_id = $1 AND silindi = FALSE ORDER BY ad ASC"
        : "SELECT * FROM klasorler WHERE ust_klasor_id IS NULL AND silindi = FALSE ORDER BY ad ASC";

    const dosyaQuery =
      klasor_id && klasor_id !== "null"
        ? "SELECT * FROM dosyalar WHERE klasor_id = $1 AND silindi = FALSE ORDER BY id DESC"
        : "SELECT * FROM dosyalar WHERE klasor_id IS NULL AND silindi = FALSE ORDER BY id DESC";

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
// 2. DRIVE ARAMA (GELİŞMİŞ)
// URL: GET /drive/ara?q=...
// ==========================================
router.get("/ara", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const dosyaSonuc = await pool.query(
      "SELECT * FROM dosyalar WHERE ad ILIKE $1 AND silindi = FALSE",
      [`%${q}%`]
    );
    const klasorSonuc = await pool.query(
      "SELECT * FROM klasorler WHERE ad ILIKE $1 AND silindi = FALSE",
      [`%${q}%`]
    );

    // Frontend genelde tek liste beklediği için birleştiriyoruz, tipini belirtiyoruz
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
// 3. İSTATİSTİKLER (YENİ - PROFESYONEL)
// URL: GET /drive/istatistik
// ==========================================
router.get("/istatistik", async (req, res) => {
  try {
    // Toplam boyut, dosya sayısı
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
// 4. KLASÖR OLUŞTUR
// ==========================================
router.post("/klasor", async (req, res) => {
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
    res.status(500).send("Klasör oluşturulamadı");
  }
});

// ==========================================
// 5. DOSYA YÜKLE
// ==========================================
router.post("/dosya", upload.single("dosya"), async (req, res) => {
  try {
    const { klasor_id, yukleyen } = req.body;
    const file = req.file;

    if (!file) return res.status(400).send("Dosya yok");

    const pid = klasor_id && klasor_id !== "null" ? klasor_id : null;

    await pool.query(
      "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, klasor_id, yukleyen, tarih) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
      [
        file.originalname,
        file.filename,
        file.filename,
        path.extname(file.originalname),
        file.size,
        pid,
        yukleyen,
      ]
    );

    res.json({ message: "Dosya yüklendi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Dosya yüklenemedi");
  }
});

// ==========================================
// 6. İŞLEMLER (İsim Değiştir, Sil, Taşı)
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
  // Soft Delete
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
  // Soft Delete
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

    // Kaynak ve Hedef Yolları
    const kaynakYol = path.join(__dirname, "../../uploads", dosya.fiziksel_ad); // 'api' klasörünün bir üstüne çıkıp 'uploads'a gitmeli
    const hedefYol = path.join(__dirname, "../../uploads", yeniFizikselAd);

    // Fiziksel Kopyalama (Hata yönetimi ile)
    try {
      if (fs.existsSync(kaynakYol)) {
        fs.copyFileSync(kaynakYol, hedefYol);
      } else {
        // Dosya fiziksel olarak yoksa bile veritabanında kopyasını oluştur (pointer hatası olmasın)
        // Veya hata dön. Biz hata dönelim güvenli olsun.
        return res
          .status(500)
          .json({ error: "Fiziksel dosya bulunamadı, kopyalanamadı." });
      }
    } catch (fsError) {
      console.error("Dosya kopyalama hatası:", fsError);
      return res.status(500).json({ error: "Disk yazma hatası" });
    }

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

    res.json({ message: "Kopyalandı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Kopyalama hatası");
  }
});

// ==========================================
// 7. ÇÖP KUTUSU YÖNETİMİ
// ==========================================

// Çöpü Listele
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

// Geri Yükle
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

// Tekil Kalıcı Sil
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
      // Klasör silinince içindekiler de silinmeli (Cascade mantığı eklenebilir)
      await pool.query("DELETE FROM klasorler WHERE id = $1", [id]);
    }
    res.json({ message: "Kalıcı olarak silindi" });
  } catch (err) {
    res.status(500).send("Hata");
  }
});

// TOPLU ÇÖP TEMİZLİĞİ (YENİ ÖZELLİK 🧹)
// URL: DELETE /drive/copu-bosalt
router.delete("/copu-bosalt", async (req, res) => {
  try {
    // 1. Silinecek dosyaların fiziksel isimlerini al
    const silinecekler = await pool.query(
      "SELECT fiziksel_ad FROM dosyalar WHERE silindi = TRUE"
    );

    // 2. Fiziksel dosyaları sil
    silinecekler.rows.forEach((file) => {
      const yol = path.join(__dirname, "../../uploads", file.fiziksel_ad);
      if (fs.existsSync(yol)) fs.unlinkSync(yol);
    });

    // 3. Veritabanından sil
    await pool.query("DELETE FROM dosyalar WHERE silindi = TRUE");
    await pool.query("DELETE FROM klasorler WHERE silindi = TRUE");

    res.json({ message: "Çöp kutusu tamamen temizlendi." });
  } catch (err) {
    console.error("TEMİZLİK HATASI:", err.message);
    res.status(500).send("Temizlik yapılamadı");
  }
});

// PERİYODİK TEMİZLİK (30 Günden Eskileri Sil)
// URL: DELETE /drive/otomatik-temizle (CronJob ile çağrılabilir)
router.delete("/otomatik-temizle", async (req, res) => {
  try {
    // 30 gün önce: NOW() - INTERVAL '30 days'

    // 1. Dosyaları Bul
    const eskiler = await pool.query(
      "SELECT fiziksel_ad FROM dosyalar WHERE silindi = TRUE AND tarih < NOW() - INTERVAL '30 days'"
    );

    // 2. Fiziksel Sil
    eskiler.rows.forEach((file) => {
      const yol = path.join(__dirname, "../../uploads", file.fiziksel_ad);
      if (fs.existsSync(yol)) fs.unlinkSync(yol);
    });

    // 3. DB Temizlik
    await pool.query(
      "DELETE FROM dosyalar WHERE silindi = TRUE AND tarih < NOW() - INTERVAL '30 days'"
    );

    res.json({ message: `${eskiler.rows.length} adet eski dosya temizlendi.` });
  } catch (err) {
    console.error(err);
    res.status(500).send("Otomatik temizlik hatası");
  }
});

module.exports = router;
