const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ==========================================
// 1. DASHBOARD ÖZETİ (GELİŞMİŞ ANALİZ 📊)
// URL: GET /dashboard/ozet
// ==========================================
router.get("/ozet", async (req, res) => {
  try {
    // 1. GENEL SAYAÇLAR
    const [kullanici, gorev, proje, satinAlma] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM kullanicilar"),
      pool.query("SELECT COUNT(*) FROM gorevler"),
      pool.query("SELECT COUNT(*) FROM projeler"),
      pool.query("SELECT COUNT(*) FROM satin_alma"),
    ]);

    // 2. GÖREV DURUMLARI (Pasta Grafiği İçin)
    const gorevDurumlari = await pool.query(`
      SELECT durum, COUNT(*) as count 
      FROM gorevler 
      GROUP BY durum
    `);

    // 3. PROJE BAZLI İLERLEME (Bar Grafiği ve Liste İçin)
    const projeIlerleme = await pool.query(`
      SELECT p.ad, 
             COUNT(g.id) as toplam_is,
             SUM(CASE WHEN g.durum = 'Yapıldı' THEN 1 ELSE 0 END) as biten_is
      FROM projeler p
      LEFT JOIN gorevler g ON p.id = g.proje_id
      GROUP BY p.id, p.ad
    `);

    // 4. FİNANSAL ÖZET - ARRAY OLARAK DÖNÜYOR
    const finansOzet = await pool.query(`
      SELECT 
        CASE 
          WHEN para_birimi IN ('TL', 'TRY', '₺') THEN 'TL'
          WHEN para_birimi IN ('USD', '$') THEN 'USD'
          WHEN para_birimi IN ('EUR', '€', 'EURO') THEN 'EUR'
          WHEN para_birimi IN ('GBP', '£') THEN 'GBP'
          ELSE para_birimi 
        END as paraBirimi,
        COUNT(*) as bekleyenAdet,
        SUM(tutar) as toplamTutar
      FROM satin_alma 
      WHERE durum LIKE '%Bekliyor%'
      GROUP BY 
        CASE 
          WHEN para_birimi IN ('TL', 'TRY', '₺') THEN 'TL'
          WHEN para_birimi IN ('USD', '$') THEN 'USD'
          WHEN para_birimi IN ('EUR', '€', 'EURO') THEN 'EUR'
          WHEN para_birimi IN ('GBP', '£') THEN 'GBP'
          ELSE para_birimi 
        END
      ORDER BY paraBirimi
    `);

    // Eğer hiç veri yoksa varsayılan array oluştur
    let finansArray = finansOzet.rows;
    if (finansArray.length === 0) {
      finansArray = [
        { paraBirimi: "TL", bekleyenAdet: 0, toplamTutar: 0 },
        { paraBirimi: "USD", bekleyenAdet: 0, toplamTutar: 0 },
        { paraBirimi: "EUR", bekleyenAdet: 0, toplamTutar: 0 },
        { paraBirimi: "GBP", bekleyenAdet: 0, toplamTutar: 0 },
      ];
    }

    // 5. BUGÜN İZİNLİ OLANLAR
    const bugun = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const izinliler = await pool.query(
      `
      SELECT COUNT(*) 
      FROM izinler 
      WHERE durum LIKE '%Onaylandı%' 
      AND $1 BETWEEN baslangic_tarihi AND bitis_tarihi
    `,
      [bugun]
    );

    // 6. RİSKLİ / YAKLAŞAN İŞLER (Teslimine 3 gün kalan veya gecikenler)
    const riskliIsler = await pool.query(`
      SELECT id, baslik, tarih, atananlar, durum 
      FROM gorevler 
      WHERE durum != 'Yapıldı' 
      AND tarih <= CURRENT_DATE + INTERVAL '3 days'
      ORDER BY tarih ASC
      LIMIT 5
    `);

    // 7. TAMAMLANAN TOPLAM İŞ
    const bitenIsler = await pool.query(
      "SELECT COUNT(*) FROM gorevler WHERE durum = 'Yapıldı'"
    );

    // VERİ PAKETLEME
    const ozet = {
      toplamKullanici: parseInt(kullanici.rows[0].count),
      toplamGorev: parseInt(gorev.rows[0].count),
      toplamProje: parseInt(proje.rows[0].count),
      toplamTalep: parseInt(satinAlma.rows[0].count),

      gorevDurumlari: gorevDurumlari.rows,
      projeIlerleme: projeIlerleme.rows,

      // DÜZELTME: Array olarak gönderiyoruz
      finans: finansArray,

      bugunIzinli: parseInt(izinliler.rows[0].count),
      riskliIsler: riskliIsler.rows,
      bitenIsler: parseInt(bitenIsler.rows[0].count),
    };

    res.json(ozet);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Dashboard verileri alınamadı");
  }
});

// ==========================================
// 2. BİLDİRİMLER (MEVCUT KODU KORU)
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
    res.status(500).send("Hata");
  }
});

router.put("/bildirimler/hepsini-oku", async (req, res) => {
  try {
    const { kime } = req.query;
    await pool.query(
      `UPDATE bildirimler SET okundu = TRUE WHERE (kime = $1 OR kime = 'İlgililer' OR kime = 'Tümü') AND okundu = FALSE`,
      [kime]
    );
    res.json({ message: "Okundu" });
  } catch (err) {
    console.error(err);
  }
});

router.post("/bildirimler", async (req, res) => {
  try {
    const { mesaj, kime, gorev_id } = req.body;
    const result = await pool.query(
      "INSERT INTO bildirimler (mesaj, kime, gorev_id) VALUES ($1, $2, $3) RETURNING *",
      [mesaj, kime, gorev_id || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
  }
});

router.put("/bildirimler/:id/oku", async (req, res) => {
  try {
    await pool.query("UPDATE bildirimler SET okundu = TRUE WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ message: "Okundu" });
  } catch (e) {
    console.error(e);
  }
});

module.exports = router;
