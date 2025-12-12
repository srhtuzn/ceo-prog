const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const auth = require("../middleware/authMiddleware"); // <--- GÜVENLİK EKLENDİ

// ==========================================
// 1. KULLANICININ ANLIK DURUMU (GÜVENLİ 🔒)
// URL: GET /mesai/durum
// ==========================================
router.get("/durum", auth, async (req, res) => {
  try {
    // ID'yi Token'dan alıyoruz
    const userId = req.user.id;

    // Tarih fark etmeksizin, kapanmamış (bitis IS NULL) son kaydı getir.
    const kayit = await pool.query(
      "SELECT * FROM mesai_kayitlari WHERE kullanici_id = $1 AND bitis IS NULL ORDER BY id DESC LIMIT 1",
      [userId]
    );

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
// 2. GİRİŞ YAP (CHECK-IN) (GÜVENLİ 🔒)
// ==========================================
router.post("/giris", auth, async (req, res) => {
  try {
    const userId = req.user.id; // Token'dan al (Body'den DEĞİL)
    const { aciklama } = req.body;

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

    let durum = "Çalışıyor";

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
// 3. ÇIKIŞ YAP (CHECK-OUT) (GÜVENLİ 🔒)
// ==========================================
router.put("/cikis", auth, async (req, res) => {
  try {
    const userId = req.user.id; // Token'dan al

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

    // Mesai Türü Belirle (Örn: 9 saat = 540 dk üzeri fazla mesai)
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
// 4. GEÇMİŞ KAYITLAR (GÜVENLİ 🔒)
// ==========================================
router.get("/gecmis", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRol = req.user.rol;
    const { tumu } = req.query;

    let query = `
              SELECT m.*, k.ad_soyad, k.avatar 
              FROM mesai_kayitlari m
              JOIN kullanicilar k ON m.kullanici_id = k.id
          `;
    const params = [];

    // Yönetici kontrolü
    const isManager = ["Genel Müdür", "İnsan Kaynakları", "Yönetim"].some((r) =>
      userRol.includes(r)
    );

    if (isManager && tumu === "true") {
      // Filtre yok, hepsini getir
    } else {
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

// ==========================================
// 5. BUGÜNKÜ KAYITLAR (YÖNETİCİ PANELİ İÇİN)
// ==========================================
router.get("/bugunku", auth, async (req, res) => {
  try {
    const query = `
        SELECT m.*, k.ad_soyad, k.avatar 
        FROM mesai_kayitlari m
        JOIN kullanicilar k ON m.kullanici_id = k.id
        WHERE DATE(m.baslangic) = CURRENT_DATE 
          OR DATE(m.bitis) = CURRENT_DATE 
        ORDER BY m.baslangic DESC
      `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Bugünkü kayıtlar alınamadı");
  }
});

// ==========================================
// 6. ŞU AN İÇERİDE OLANLAR (DÜZELTİLEN KISIM 🌙)
// ==========================================
router.get("/bugunku-aktif", auth, async (req, res) => {
  try {
    // Sadece "bitis IS NULL" kontrolü yapıyoruz.
    const query = `
        SELECT m.*, k.ad_soyad, k.avatar, k.departman 
        FROM mesai_kayitlari m
        JOIN kullanicilar k ON m.kullanici_id = k.id
        WHERE m.bitis IS NULL
        ORDER BY m.baslangic DESC
      `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Aktif kayıtlar alınamadı");
  }
});

// ==========================================
// 7. RAPORLAMA
// ==========================================
router.get("/rapor", auth, async (req, res) => {
  try {
    const { ay } = req.query; // 'YYYY-MM'
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
