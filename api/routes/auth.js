// api/routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const { upload } = require("../config/upload");

// ==========================================
// --- KAYIT OL ---
// URL: POST /auth/register
// ==========================================
router.post("/register", async (req, res) => {
  try {
    const { ad_soyad, email, sifre, departman, pozisyon, rol } = req.body;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(sifre, salt);

    // İlk kullanıcı otomatik Genel Müdür
    const userCount = await pool.query("SELECT COUNT(*) FROM kullanicilar");
    let durum = "Bekliyor";
    let secilenRol = rol || "Personel";

    if (parseInt(userCount.rows[0].count) === 0) {
      durum = "Aktif";
      secilenRol = "Genel Müdür";
    }

    const newUser = await pool.query(
      "INSERT INTO kullanicilar (ad_soyad, email, sifre, departman, pozisyon, rol, hesap_durumu) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [ad_soyad, email, hashedPassword, departman, pozisyon, secilenRol, durum]
    );

    if (durum === "Bekliyor") {
      const bildirimMesaji = `👤 YENİ PERSONEL: "${ad_soyad}" aramıza katılmak istiyor. Onayınız bekleniyor.`;
      const yoneticiler = await pool.query(`
        SELECT ad_soyad FROM kullanicilar
        WHERE rol IN ('Genel Müdür', 'İnsan Kaynakları', 'Yönetim', 'Departman Müdürü')
      `);
      for (let y of yoneticiler.rows) {
        await pool.query(
          "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
          [bildirimMesaji, y.ad_soyad]
        );
      }
    }

    res.json(newUser.rows[0]);
  } catch (err) {
    console.error("REGISTER HATASI:", err.message);
    res.status(500).send("Kayıt hatası.");
  }
});

// ==========================================
// --- GİRİŞ YAP ---
// URL: POST /auth/login
// ==========================================
router.post("/login", async (req, res) => {
  try {
    const { email, sifre } = req.body;
    const user = await pool.query(
      "SELECT * FROM kullanicilar WHERE email = $1",
      [email]
    );
    if (user.rows.length === 0)
      return res.status(401).json("Email veya şifre hatalı");

    const u = user.rows[0];
    if (u.hesap_durumu === "Bekliyor")
      return res.status(403).json("Hesabınız henüz onaylanmadı.");
    if (u.hesap_durumu === "Reddedildi")
      return res.status(403).json("Hesabınız reddedilmiştir.");

    const validPassword = await bcrypt.compare(sifre, u.sifre);
    if (!validPassword) return res.status(401).json("Email veya şifre hatalı");

    delete u.sifre;
    res.json(u);
  } catch (err) {
    console.error("LOGIN HATASI:", err.message);
    res.status(500).send("Sunucu hatası");
  }
});

// ==========================================
// --- PROFİL FOTOĞRAFI ---
// URL: POST /auth/avatar/:id
// ==========================================
router.post("/avatar/:id", upload.single("avatar"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).send("Dosya yüklenmedi");

    const userQuery = await pool.query(
      "SELECT avatar FROM kullanicilar WHERE id = $1",
      [id]
    );
    const eskiAvatar = userQuery.rows[0]?.avatar;
    if (eskiAvatar) {
      const eskiPath = path.join(__dirname, "..", "uploads", eskiAvatar);
      if (fs.existsSync(eskiPath)) fs.unlinkSync(eskiPath);
    }

    await pool.query("UPDATE kullanicilar SET avatar = $1 WHERE id = $2", [
      req.file.filename,
      id,
    ]);

    res.json({ avatar: req.file.filename });
  } catch (err) {
    console.error("AVATAR HATASI:", err.message);
    res.status(500).send("Yükleme hatası");
  }
});

// ==========================================
// --- PROFİL GÜNCELLEME ---
// URL: PUT /auth/profil/:id
// ==========================================
router.put("/profil/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { ad_soyad, pozisyon } = req.body;
    const update = await pool.query(
      "UPDATE kullanicilar SET ad_soyad=$1, pozisyon=$2 WHERE id=$3 RETURNING id, ad_soyad, email, departman, pozisyon, rol, avatar, hesap_durumu",
      [ad_soyad, pozisyon, id]
    );
    res.json(update.rows[0]);
  } catch (err) {
    console.error("PROFİL GÜNCELLEME HATASI:", err.message);
    res.status(500).send("Hata");
  }
});

// ==========================================
// --- ŞİFRE DEĞİŞTİRME ---
// URL: PUT /auth/sifre/:id
// ==========================================
router.put("/sifre/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { eskiSifre, yeniSifre } = req.body;

    const user = await pool.query("SELECT * FROM kullanicilar WHERE id=$1", [
      id,
    ]);
    if (user.rows.length === 0) return res.status(404).json("Kullanıcı yok");

    const validPassword = await bcrypt.compare(eskiSifre, user.rows[0].sifre);
    if (!validPassword) return res.status(401).json("Eski şifre hatalı");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(yeniSifre, salt);

    await pool.query("UPDATE kullanicilar SET sifre=$1 WHERE id=$2", [
      hashedPassword,
      id,
    ]);
    res.json({ message: "Şifre değiştirildi" });
  } catch (err) {
    console.error("ŞİFRE HATASI:", err.message);
    res.status(500).send("Hata");
  }
});

// ==========================================
// --- PERSONEL ONAY ---
// URL: PUT /auth/onay/:id
// ==========================================
router.put("/onay/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { durum } = req.body;

    await pool.query("UPDATE kullanicilar SET hesap_durumu=$1 WHERE id=$2", [
      durum,
      id,
    ]);
    res.json({ message: "Kullanıcı durumu güncellendi." });
  } catch (err) {
    console.error("ONAY HATASI:", err.message);
    res.status(500).send("Hata");
  }
});

module.exports = router;
