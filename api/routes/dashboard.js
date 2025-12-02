// api/routes/dashboard.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ==========================================
// 1. DASHBOARD ÖZETİ
// URL: GET /dashboard/ozet
// ==========================================
router.get("/ozet", async (req, res) => {
  try {
    const [kullanici, gorev, proje, satinAlma] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM kullanicilar"),
      pool.query("SELECT COUNT(*) FROM gorevler"),
      pool.query("SELECT COUNT(*) FROM projeler"),
      pool.query("SELECT COUNT(*) FROM satin_alma"),
    ]);

    const gorevDurumlari = await pool.query(
      `SELECT durum, COUNT(*) FROM gorevler GROUP BY durum`
    );
    const bekleyenTalepler = await pool.query(
      "SELECT COUNT(*) FROM satin_alma WHERE durum LIKE '%Bekliyor%'"
    );

    const ozet = {
      toplamKullanici: parseInt(kullanici.rows[0].count),
      toplamGorev: parseInt(gorev.rows[0].count),
      toplamProje: parseInt(proje.rows[0].count),
      toplamTalep: parseInt(satinAlma.rows[0].count),
      gorevDurumlari: gorevDurumlari.rows,
      bekleyenTalepler: parseInt(bekleyenTalepler.rows[0].count),
    };

    res.json(ozet);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Dashboard verileri alınamadı");
  }
});

// ==========================================
// 2. BİLDİRİMLER
// URL: GET /dashboard/bildirimler
// ==========================================
router.get("/bildirimler", async (req, res) => {
  try {
    const { kime } = req.query;
    const result = await pool.query(
      `SELECT * FROM bildirimler WHERE (kime = $1 OR kime = 'İlgililer' OR kime = 'Tümü') ORDER BY tarih DESC`,
      [kime]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Bildirimler getirilemedi");
  }
});

// ==========================================
// 3. BİLDİRİMLERİ OKU
// URL: PUT /dashboard/bildirimler/hepsini-oku
// ==========================================
router.put("/bildirimler/hepsini-oku", async (req, res) => {
  try {
    const { kime } = req.query;
    await pool.query(
      "UPDATE bildirimler SET okundu = TRUE WHERE kime = $1 OR kime = 'Tümü'",
      [kime]
    );
    res.json({ message: "Tüm bildirimler okundu" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Bildirim güncellenemedi");
  }
});

// ==========================================
// 4. YENİ BİLDİRİM EKLE
// URL: POST /dashboard/bildirimler
// ==========================================
router.post("/bildirimler", async (req, res) => {
  try {
    const { mesaj, kime, gorev_id } = req.body;
    const result = await pool.query(
      "INSERT INTO bildirimler (mesaj, kime, gorev_id) VALUES ($1, $2, $3) RETURNING *",
      [mesaj, kime, gorev_id || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Bildirim eklenemedi");
  }
});

module.exports = router;
