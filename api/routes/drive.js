// api/routes/drive.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// -----------------------------------------
// MULTER AYARI (Dosya yükleme için)
// -----------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});
const upload = multer({ storage });

// -----------------------------------------
// 1. KLASÖR İÇERİĞİ GETİR
// -----------------------------------------
router.get("/icerik", async (req, res) => {
  try {
    const { klasor_id, userId } = req.query;

    const klasorQuery =
      klasor_id && klasor_id !== "null"
        ? "SELECT * FROM klasorler WHERE ust_klasor_id = $1 AND silindi = FALSE ORDER BY id DESC"
        : "SELECT * FROM klasorler WHERE ust_klasor_id IS NULL AND silindi = FALSE ORDER BY id DESC";
    const dosyaQuery =
      klasor_id && klasor_id !== "null"
        ? "SELECT * FROM dosyalar WHERE klasor_id = $1 AND silindi = FALSE ORDER BY id DESC"
        : "SELECT * FROM dosyalar WHERE klasor_id IS NULL AND silindi = FALSE ORDER BY id DESC";

    const params = klasor_id && klasor_id !== "null" ? [klasor_id] : [];
    const klasorler = await pool.query(klasorQuery, params);
    const dosyalar = await pool.query(dosyaQuery, params);

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

// -----------------------------------------
// 2. KLASÖR OLUŞTUR
// -----------------------------------------
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

// -----------------------------------------
// 3. DOSYA YÜKLE
// -----------------------------------------
router.post("/dosya", upload.single("dosya"), async (req, res) => {
  try {
    const { klasor_id, yukleyen } = req.body;
    const file = req.file;

    if (!file) return res.status(400).send("Dosya yok");

    const pid = klasor_id && klasor_id !== "null" ? klasor_id : null;

    await pool.query(
      "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, klasor_id, yukleyen) VALUES ($1, $2, $3, $4, $5, $6, $7)",
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

// -----------------------------------------
// 4. DOSYA ADI GÜNCELLE
// -----------------------------------------
router.put("/dosya/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { yeniAd } = req.body;
    await pool.query("UPDATE dosyalar SET ad = $1 WHERE id = $2", [yeniAd, id]);
    res.json({ message: "Dosya adı güncellendi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Güncelleme hatası");
  }
});

// -----------------------------------------
// 5. DOSYA SİL (SOFT DELETE)
// -----------------------------------------
router.delete("/dosya/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE dosyalar SET silindi = TRUE WHERE id = $1", [id]);
    res.json({ message: "Dosya çöp kutusuna taşındı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Silme hatası");
  }
});

// -----------------------------------------
// 6. DOSYA TAŞIMA (DRAG-DROP)
// -----------------------------------------
router.put("/tasi", async (req, res) => {
  try {
    const { dosyaId, hedefKlasorId } = req.body;
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

// -----------------------------------------
// 7. DOSYA KOPYALA
// -----------------------------------------
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
    const kaynakYol = path.join(__dirname, "../uploads", dosya.fiziksel_ad);
    const hedefYol = path.join(__dirname, "../uploads", yeniFizikselAd);

    if (fs.existsSync(kaynakYol)) fs.copyFileSync(kaynakYol, hedefYol);
    else return res.status(500).json({ error: "Fiziksel dosya bulunamadı" });

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

// -----------------------------------------
// 8. KLASÖR SİL (SOFT DELETE)
// -----------------------------------------
router.delete("/klasor/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE klasorler SET silindi = TRUE WHERE id = $1", [id]);
    res.json({ message: "Klasör çöp kutusuna taşındı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Klasör silme hatası");
  }
});

// -----------------------------------------
// 9. ÇÖP KUTUSU LİSTELE
// -----------------------------------------
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
    console.error(err.message);
    res.status(500).send("Çöp kutusu alınamadı");
  }
});

// -----------------------------------------
// 10. GERİ YÜKLE
// -----------------------------------------
router.put("/geri-yukle", async (req, res) => {
  try {
    const { id, tip } = req.body;
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
    res.status(500).send("Geri yükleme hatası");
  }
});

// -----------------------------------------
// 11. KALICI SİL (HARD DELETE)
// -----------------------------------------
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
          "../uploads",
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
    console.error(err.message);
    res.status(500).send("Kalıcı silme hatası");
  }
});

module.exports = router;
