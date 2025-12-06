const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// 1. TÜM KATEGORİLERİ VE İÇİNDEKİ SÜREÇLERİ GETİR (Katalog)
router.get("/katalog", async (req, res) => {
  try {
    // Kategorileri çek
    const kategoriler = await pool.query(
      "SELECT * FROM surec_kategorileri ORDER BY id ASC"
    );

    // Her kategori için süreçleri çek
    const sonuc = await Promise.all(
      kategoriler.rows.map(async (kat) => {
        const surecler = await pool.query(
          "SELECT * FROM surecler WHERE kategori_id = $1",
          [kat.id]
        );
        return {
          ...kat,
          surecler: surecler.rows,
        };
      })
    );

    res.json(sonuc);
  } catch (err) {
    console.error(err);
    res.status(500).send("Katalog hatası");
  }
});

// 2. SÜREÇ DETAYINI VE ADIMLARINI GETİR
router.get("/detay/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Süreç bilgisi
    const surec = await pool.query("SELECT * FROM surecler WHERE id = $1", [
      id,
    ]);
    if (surec.rows.length === 0)
      return res.status(404).send("Süreç bulunamadı");

    // Adımlar
    const adimlar = await pool.query(
      "SELECT * FROM surec_adimlari WHERE surec_id = $1 ORDER BY sira_no ASC",
      [id]
    );

    res.json({
      bilgi: surec.rows[0],
      adimlar: adimlar.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Detay hatası");
  }
});

// 3. DEMO VERİ OLUŞTURUCU (Sihirli Buton İçin 🪄)
// Bu endpoint çağrıldığında veritabanını örnek süreçlerle doldurur.
router.post("/demo-olustur", async (req, res) => {
  try {
    // Önce temizle
    await pool.query(
      "TRUNCATE TABLE surec_kategorileri RESTART IDENTITY CASCADE"
    );

    // A. KATEGORİLER
    const k1 = await pool.query(
      "INSERT INTO surec_kategorileri (ad, ikon, renk) VALUES ($1, $2, $3) RETURNING id",
      ["Yazılım Geliştirme", "CodeOutlined", "#1890ff"]
    );
    const k2 = await pool.query(
      "INSERT INTO surec_kategorileri (ad, ikon, renk) VALUES ($1, $2, $3) RETURNING id",
      ["İnsan Kaynakları", "TeamOutlined", "#eb2f96"]
    );

    // B. SÜREÇLER
    // Yazılım Süreci
    const s1 = await pool.query(
      "INSERT INTO surecler (kategori_id, baslik, aciklama, zorluk_seviyesi, tahmini_sure) VALUES ($1, $2, $3, 'Zor', '2 Hafta') RETURNING id",
      [
        k1.rows[0].id,
        "Yeni Özellik Geliştirme",
        "Bir feature isteğinin analziden canlıya alınmasına kadar geçen süreç.",
      ]
    );

    // İK Süreci
    const s2 = await pool.query(
      "INSERT INTO surecler (kategori_id, baslik, aciklama, zorluk_seviyesi, tahmini_sure) VALUES ($1, $2, $3, 'Orta', '3 Gün') RETURNING id",
      [
        k2.rows[0].id,
        "Yeni Personel Onboarding",
        "İşe yeni başlayan personelin oryantasyon süreci.",
      ]
    );

    // C. ADIMLAR (Yazılım)
    await pool.query(
      "INSERT INTO surec_adimlari (surec_id, sira_no, baslik, detay_aciklama, sorumlu_rol) VALUES ($1, 1, 'İhtiyaç Analizi', 'Müşteri veya PO ile görüşülüp gereksinimler dökümante edilir.', 'İş Analisti')",
      [s1.rows[0].id]
    );
    await pool.query(
      "INSERT INTO surec_adimlari (surec_id, sira_no, baslik, detay_aciklama, sorumlu_rol) VALUES ($1, 2, 'Teknik Tasarım', 'Veritabanı şeması ve API uçları tasarlanır.', 'Senior Developer')",
      [s1.rows[0].id]
    );
    await pool.query(
      "INSERT INTO surec_adimlari (surec_id, sira_no, baslik, detay_aciklama, sorumlu_rol) VALUES ($1, 3, 'Kodlama & Test', 'Kod geliştirilir ve unit testleri yazılır.', 'Developer')",
      [s1.rows[0].id]
    );

    // C. ADIMLAR (İK)
    await pool.query(
      "INSERT INTO surec_adimlari (surec_id, sira_no, baslik, detay_aciklama, sorumlu_rol) VALUES ($1, 1, 'Evrak Toplama', 'Kimlik, diploma, sabıka kaydı vb. evraklar drive''a yüklenir.', 'İK Uzmanı')",
      [s2.rows[0].id]
    );
    await pool.query(
      "INSERT INTO surec_adimlari (surec_id, sira_no, baslik, detay_aciklama, sorumlu_rol) VALUES ($1, 2, 'E-Posta ve Sistem Tanımları', 'Şirket maili açılır, ERP hesabı tanımlanır.', 'IT Destek')",
      [s2.rows[0].id]
    );

    res.json({ message: "Demo süreçler başarıyla oluşturuldu!" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Demo oluşturma hatası");
  }
});

module.exports = router;
