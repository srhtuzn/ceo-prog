const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ==========================================
// 1. GÜNLÜK DURUMU GETİR (DÜZELTİLDİ: Tarih fark etmeksizin açık kayıt var mı?)
// URL: GET /mesai/durum?userId=...
// ==========================================
router.get("/durum", async (req, res) => {
  try {
    const { userId } = req.query;

    // DÜZELTME: 'AND tarih = CURRENT_DATE' kaldırıldı.
    // Böylece dünden kalan "kapanmamış" mesaileri de görür ve "Çıkış Yap" butonunu gösterir.
    const kayit = await pool.query(
      "SELECT * FROM mesai_kayitlari WHERE kullanici_id = $1 AND bitis IS NULL ORDER BY id DESC LIMIT 1",
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
      return res
        .status(400)
        .json({ error: "Zaten giriş yapılmış! Önce çıkış yapmalısınız." });
    }

    // Geç Kalma Kontrolü (09:15)
    const simdi = new Date();
    const limit = new Date();
    limit.setHours(9, 15, 0);

    let durum = "Çalışıyor";
    // İsterseniz burayı aktif edebilirsiniz:
    // if (simdi > limit) durum = "Geç Başladı";

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

    // Mesai Türü Belirle (9 saat = 540 dk üzeri mesai sayılır)
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
// mesai.js - yeni endpoint ekleyin
router.get("/bugunku", async (req, res) => {
  try {
    const { tumu } = req.query;

    let query = `
      SELECT m.*, k.ad_soyad, k.avatar 
      FROM mesai_kayitlari m
      JOIN kullanicilar k ON m.kullanici_id = k.id
      WHERE DATE(m.baslangic) = CURRENT_DATE
    `;

    const params = [];

    // Eğer sadece kendi kayıtlarını istiyorsa
    if (!tumu || tumu === "false") {
      const { userId } = req.query;
      if (userId) {
        query += ` AND m.kullanici_id = $1`;
        params.push(userId);
      }
    }

    query += " ORDER BY m.baslangic DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Bugünkü kayıtlar alınamadı");
  }
});
// mesai.js dosyasına bu endpointi ekleyin
router.get("/bugunku-aktif", async (req, res) => {
  try {
    const query = `
      SELECT m.*, k.ad_soyad, k.avatar, k.departman 
      FROM mesai_kayitlari m
      JOIN kullanicilar k ON m.kullanici_id = k.id
      WHERE DATE(m.baslangic) = CURRENT_DATE 
      AND m.bitis IS NULL
      ORDER BY m.baslangic DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Bugünkü aktif kayıtlar alınamadı");
  }
});

// ==========================================
// 5. AYLIK PUANTAJ RAPORU (EXCEL İÇİN) 📊
// URL: GET /mesai/rapor?ay=2025-01
// ==========================================
router.get("/rapor", async (req, res) => {
  try {
    const { ay } = req.query; // Format: 'YYYY-MM'
    if (!ay) return res.status(400).send("Ay bilgisi gerekli");

    const raporQuery = `
            SELECT 
                k.ad_soyad as "Personel",
                k.departman as "Departman",
                m.tarih as "Tarih",
                TO_CHAR(m.baslangic, 'HH24:MI') as "Giris",
                TO_CHAR(m.bitis, 'HH24:MI') as "Cikis",
                m.sure_dakika as "Sure_DK",
                ROUND(m.sure_dakika / 60.0, 2) as "Sure_Saat",
                m.mesai_turu as "Durum"
            FROM mesai_kayitlari m
            JOIN kullanicilar k ON m.kullanici_id = k.id
            WHERE TO_CHAR(m.tarih, 'YYYY-MM') = $1
            ORDER BY m.tarih DESC, k.ad_soyad ASC
        `;

    const result = await pool.query(raporQuery, [ay]);
    res.json(result.rows);
  } catch (err) {
    console.error("RAPOR HATASI:", err);
    res.status(500).send("Rapor oluşturulamadı");
  }
});

module.exports = router;
