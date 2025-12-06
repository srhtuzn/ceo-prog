const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { upload } = require("../config/upload");
const path = require("path");

// ==========================================
// 1. SOHBET LİSTESİNİ GETİR
// URL: GET /chat/list?userId=...
// ==========================================
router.get("/list", async (req, res) => {
  try {
    const { userId } = req.query;
    const query = `
      SELECT 
        s.id, s.tip, s.son_mesaj, s.son_mesaj_tarihi, s.olusturan_id,
        sk.okunmamis_sayisi, sk.rol,
        CASE WHEN s.tip = 'grup' THEN s.ad ELSE k.ad_soyad END as chat_name,
        CASE WHEN s.tip = 'grup' THEN s.avatar ELSE k.avatar END as chat_avatar,
        k.id as other_user_id, k.hesap_durumu as other_user_status
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
    res.status(500).send("Hata");
  }
});

// ==========================================
// 2. SOHBET GEÇMİŞİ
// URL: GET /chat/history/:sohbetId
// ==========================================
router.get("/history/:sohbetId", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT m.*, k.ad_soyad as gonderen_adi, k.avatar as gonderen_avatar
      FROM mesajlar m
      LEFT JOIN kullanicilar k ON m.gonderen_id = k.id
      WHERE m.sohbet_id = $1 ORDER BY m.tarih ASC
    `,
      [req.params.sohbetId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Hata");
  }
});

// ==========================================
// 3. YENİ SOHBET OLUŞTUR (AKILLI KONTROL 🧠)
// URL: POST /chat/create
// ==========================================
router.post("/create", async (req, res) => {
  const client = await pool.connect();
  try {
    const { tip, ad, userIds, olusturanId } = req.body;
    // userIds: Array of IDs

    await client.query("BEGIN");

    // A. ÖZEL MESAJ İSE: Zaten var mı kontrol et?
    if (tip === "ozel") {
      const targetUserId = userIds[0]; // Özelde tek kişi vardır
      const checkQuery = `
            SELECT s.id FROM sohbetler s
            JOIN sohbet_katilimcilari sk1 ON s.id = sk1.sohbet_id AND sk1.kullanici_id = $1
            JOIN sohbet_katilimcilari sk2 ON s.id = sk2.sohbet_id AND sk2.kullanici_id = $2
            WHERE s.tip = 'ozel'
        `;
      const existingChat = await client.query(checkQuery, [
        olusturanId,
        targetUserId,
      ]);

      if (existingChat.rows.length > 0) {
        await client.query("COMMIT");
        return res.json({
          message: "Mevcut sohbet açıldı",
          id: existingChat.rows[0].id,
          exists: true,
        });
      }
    }

    // B. SOHBETİ OLUŞTUR (Yoksa veya Grupsa)
    const sohbetRes = await client.query(
      "INSERT INTO sohbetler (tip, ad, olusturan_id, son_mesaj_tarihi) VALUES ($1, $2, $3, NOW()) RETURNING id",
      [tip, ad, olusturanId]
    );
    const sohbetId = sohbetRes.rows[0].id;

    // C. KATILIMCILARI EKLE
    const tumKatilimcilar = [...new Set([...userIds, olusturanId])];
    for (const uid of tumKatilimcilar) {
      const rol = tip === "grup" && uid === olusturanId ? "admin" : "uye";
      await client.query(
        "INSERT INTO sohbet_katilimcilari (sohbet_id, kullanici_id, rol) VALUES ($1, $2, $3)",
        [sohbetId, uid, rol]
      );
    }

    // D. SİSTEM MESAJI
    if (tip === "grup") {
      await client.query(
        "INSERT INTO mesajlar (sohbet_id, gonderen_id, mesaj_tipi, icerik) VALUES ($1, $2, 'sistem', 'Grup oluşturuldu')",
        [sohbetId, olusturanId]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Sohbet oluşturuldu", id: sohbetId, exists: false });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Hata");
  } finally {
    client.release();
  }
});

// ==========================================
// 4. DOSYA YÜKLEME
// ==========================================
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("Dosya yok");
    res.json({
      dosya_yolu: req.file.filename,
      dosya_adi: req.file.originalname,
      tip: req.file.mimetype.startsWith("image/") ? "resim" : "dosya",
    });
  } catch (err) {
    res.status(500).send("Hata");
  }
});

// ==========================================
// 5. KULLANICI LİSTESİ
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

// ==========================================
// 6. SOHBET SİLME (YENİ) 🗑️
// URL: DELETE /chat/:id
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // "Cascade" kuralı sayesinde katılımcılar ve mesajlar da silinir (DB yapısına göre)
    // Eğer DB'de ON DELETE CASCADE yoksa manuel silmek gerekir.
    // Biz SQL'de CASCADE vermiştik.
    await pool.query("DELETE FROM sohbetler WHERE id = $1", [id]);
    res.json({ message: "Sohbet silindi" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Silme hatası");
  }
});

module.exports = router;
