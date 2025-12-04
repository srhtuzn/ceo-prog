const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { upload } = require("../config/upload"); // Multer config
const path = require("path");

// ==========================================
// 1. SOHBET LİSTESİNİ GETİR (WhatsApp Tarzı)
// URL: GET /chat/list?userId=...
// ==========================================
router.get("/list", async (req, res) => {
  try {
    const { userId } = req.query;

    // Bu karmaşık sorgu şunları yapar:
    // 1. Benim dahil olduğum sohbetleri bulur.
    // 2. Eğer 'ozel' sohbet ise, karşı tarafın adını ve avatarını 'chat_name' ve 'chat_avatar' olarak getirir.
    // 3. Eğer 'grup' ise, grubun kendi adını ve avatarını getirir.
    // 4. Son mesaj tarihine göre sıralar.

    const query = `
      SELECT 
        s.id, 
        s.tip, 
        s.son_mesaj, 
        s.son_mesaj_tarihi,
        sk.okunmamis_sayisi,
        CASE 
          WHEN s.tip = 'grup' THEN s.ad 
          ELSE k.ad_soyad 
        END as chat_name,
        CASE 
          WHEN s.tip = 'grup' THEN s.avatar 
          ELSE k.avatar 
        END as chat_avatar,
        k.id as other_user_id,
        k.hesap_durumu as other_user_status
      FROM sohbet_katilimcilari sk
      JOIN sohbetler s ON sk.sohbet_id = s.id
      LEFT JOIN sohbet_katilimcilari sk2 ON s.id = sk2.sohbet_id AND sk2.kullanici_id != $1 AND s.tip = 'ozel'
      LEFT JOIN kullanicilar k ON sk2.kullanici_id = k.id
      WHERE sk.kullanici_id = $1
      ORDER BY s.son_mesaj_tarihi DESC
    `;

    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Sohbet listesi alınamadı");
  }
});

// ==========================================
// 2. SOHBET GEÇMİŞİNİ GETİR
// URL: GET /chat/history/:sohbetId
// ==========================================
router.get("/history/:sohbetId", async (req, res) => {
  try {
    const { sohbetId } = req.params;
    // Mesajları ve gönderen bilgisini çek
    const result = await pool.query(
      `
      SELECT m.*, k.ad_soyad as gonderen_adi, k.avatar as gonderen_avatar
      FROM mesajlar m
      LEFT JOIN kullanicilar k ON m.gonderen_id = k.id
      WHERE m.sohbet_id = $1
      ORDER BY m.tarih ASC
    `,
      [sohbetId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Mesajlar alınamadı");
  }
});

// ==========================================
// 3. YENİ SOHBET OLUŞTUR (GRUP veya ÖZEL)
// URL: POST /chat/create
// ==========================================
router.post("/create", async (req, res) => {
  const client = await pool.connect();
  try {
    const { tip, ad, userIds, olusturanId } = req.body;
    // userIds: [1, 5, 8] gibi array olmalı (Katılımcı ID'leri)

    await client.query("BEGIN"); // Transaction Başlat

    // A. Özel Mesaj Kontrolü (Zaten var mı?)
    if (tip === "ozel") {
      // İki kişilik sohbet var mı kontrol et
      // (Bu sorgu biraz kompleks olabilir, şimdilik basit tutup direkt oluşturuyoruz)
      // Profesyonel çözümde burada "Exist" kontrolü yapılır.
    }

    // B. Sohbeti Oluştur
    const sohbetRes = await client.query(
      "INSERT INTO sohbetler (tip, ad, olusturan_id, son_mesaj_tarihi) VALUES ($1, $2, $3, NOW()) RETURNING id",
      [tip, ad, olusturanId]
    );
    const sohbetId = sohbetRes.rows[0].id;

    // C. Katılımcıları Ekle
    // Oluşturanı da ekle (Eğer listede yoksa)
    const tumKatilimcilar = [...new Set([...userIds, olusturanId])];

    for (const uid of tumKatilimcilar) {
      const rol = tip === "grup" && uid === olusturanId ? "admin" : "uye";
      await client.query(
        "INSERT INTO sohbet_katilimcilari (sohbet_id, kullanici_id, rol) VALUES ($1, $2, $3)",
        [sohbetId, uid, rol]
      );
    }

    // D. Sistem Mesajı At (Opsiyonel)
    if (tip === "grup") {
      await client.query(
        "INSERT INTO mesajlar (sohbet_id, mesaj_tipi, icerik) VALUES ($1, 'sistem', 'Grup oluşturuldu')",
        [sohbetId]
      );
    }

    await client.query("COMMIT"); // İşlemi Onayla
    res.json({ message: "Sohbet oluşturuldu", id: sohbetId });
  } catch (err) {
    await client.query("ROLLBACK"); // Hata varsa geri al
    console.error(err.message);
    res.status(500).send("Sohbet oluşturulamadı");
  } finally {
    client.release();
  }
});

// ==========================================
// 4. DOSYA YÜKLEME (Chat İçin)
// URL: POST /chat/upload
// ==========================================
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("Dosya yok");

    // Sadece dosya yolunu ve adını dönüyoruz.
    // Frontend bu bilgiyi alıp socket ile "mesaj" olarak gönderecek.
    res.json({
      dosya_yolu: req.file.filename,
      dosya_adi: req.file.originalname,
      tip: req.file.mimetype.startsWith("image/") ? "resim" : "dosya",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Yükleme hatası");
  }
});

// ==========================================
// 5. KULLANICI LİSTESİ (Grup Kurmak İçin)
// URL: GET /chat/users
// ==========================================
router.get("/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, ad_soyad, avatar, departman FROM kullanicilar WHERE hesap_durumu='Aktif' ORDER BY ad_soyad ASC"
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).send("Hata");
  }
});

module.exports = router;
