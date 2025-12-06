const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ==========================================
// 1. GÜNLÜK DURUMU GETİR (Bugün giriş yaptı mı?)
// URL: GET /mesai/durum?userId=...
// ==========================================
router.get("/durum", async (req, res) => {
  try {
    const { userId } = req.query;
    // Bugünün henüz bitmemiş (çıkış yapılmamış) kaydını bul
    const kayit = await pool.query(
      "SELECT * FROM mesai_kayitlari WHERE kullanici_id = $1 AND tarih = CURRENT_DATE AND bitis IS NULL ORDER BY id DESC LIMIT 1",
      [userId]
    );

    // Eğer çıkış yapmamışsa 'iceride: true' döner
    if (kayit.rows.length > 0) {
      res.json({ iceride: true, kayit: kayit.rows[0] });
    } else {
      res.json({ iceride: false, kayit: null });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

// ==========================================
// 2. GİRİŞ YAP (CHECK-IN)
// URL: POST /mesai/giris
// ==========================================
router.post("/giris", async (req, res) => {
  try {
    const { userId, aciklama } = req.body;

    // Önce kontrol et: Zaten içeride mi?
    const kontrol = await pool.query(
      "SELECT * FROM mesai_kayitlari WHERE kullanici_id = $1 AND bitis IS NULL",
      [userId]
    );
    if (kontrol.rows.length > 0) {
      return res.status(400).json({ error: "Zaten giriş yapılmış!" });
    }

    // Geç Kalma Kontrolü (Örn: 09:15'ten sonrası geç sayılır)
    const simdi = new Date();
    const limit = new Date();
    limit.setHours(9, 15, 0); // 09:15

    let durum = "Çalışıyor";
    // Eğer saat 9:15'i geçtiyse "Geç Kaldı" etiketi ekle
    /* Basitlik için şimdilik sadece kaydediyoruz, istersen burayı açabilirsin
    if (simdi > limit) durum = "Geç Başladı"; 
    */

    const result = await pool.query(
      "INSERT INTO mesai_kayitlari (kullanici_id, baslangic, durum, aciklama) VALUES ($1, NOW(), $2, $3) RETURNING *",
      [userId, durum, aciklama]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Giriş yapılamadı");
  }
});

// ==========================================
// 3. ÇIKIŞ YAP (CHECK-OUT)
// URL: POST /mesai/cikis
// ==========================================
router.put("/cikis", async (req, res) => {
  try {
    const { userId } = req.body;

    // Aktif kaydı bul
    const aktifKayit = await pool.query(
      "SELECT id, baslangic FROM mesai_kayitlari WHERE kullanici_id = $1 AND bitis IS NULL ORDER BY id DESC LIMIT 1",
      [userId]
    );

    if (aktifKayit.rows.length === 0)
      return res.status(400).json({ error: "Aktif giriş bulunamadı" });

    const kayitId = aktifKayit.rows[0].id;
    const baslangic = new Date(aktifKayit.rows[0].baslangic);
    const bitis = new Date();

    // Süreyi hesapla (Dakika cinsinden)
    const farkMs = bitis - baslangic;
    const sureDakika = Math.floor(farkMs / 1000 / 60);

    // Mesai Türü Belirle (Örn: 9 saat = 540 dk üzeri mesai sayılır)
    let mesaiTuru = "Normal";
    if (sureDakika > 540) mesaiTuru = "Fazla Mesai";

    const result = await pool.query(
      "UPDATE mesai_kayitlari SET bitis = NOW(), sure_dakika = $1, durum = 'Tamamlandı', mesai_turu = $2 WHERE id = $3 RETURNING *",
      [sureDakika, mesaiTuru, kayitId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Çıkış yapılamadı");
  }
});

// ==========================================
// 4. MESAİ GEÇMİŞİ (LİSTELEME)
// URL: GET /mesai/gecmis?userId=...
// ==========================================
router.get("/gecmis", async (req, res) => {
  try {
    const { userId, tumu } = req.query; // tumu=true ise yönetici herkesi görür

    let query = `
            SELECT m.*, k.ad_soyad, k.avatar 
            FROM mesai_kayitlari m
            JOIN kullanicilar k ON m.kullanici_id = k.id
        `;
    const params = [];

    // Eğer sadece kendi geçmişini istiyorsa
    if (!tumu || tumu === "false") {
      query += " WHERE m.kullanici_id = $1";
      params.push(userId);
    }

    query += " ORDER BY m.baslangic DESC LIMIT 50";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Geçmiş alınamadı");
  }
});

module.exports = router;
