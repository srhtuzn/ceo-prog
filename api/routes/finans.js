// api/routes/finans.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const multer = require("multer");
const path = require("path");
const auth = require("../middleware/authMiddleware"); // <--- GÜVENLİK BEKÇİSİ

// MULTER AYARLARI
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, "proforma-" + uniqueSuffix);
  },
});
const upload = multer({ storage });

// ==========================================
// 1. TALEPLERİ GETİR (GÜVENLİ 🔒)
// ==========================================
router.get("/", auth, async (req, res) => {
  try {
    // ID'yi URL'den değil, Token'dan alıyoruz!
    const userId = req.user.id;
    const userRol = req.user.rol;
    const userDept = req.user.departman;

    let query = "";
    let params = [];

    // Yönetici roller HER ŞEYİ görür
    if (
      ["Genel Müdür", "Yönetim", "Finans", "Muhasebe"].some(
        (r) => userRol.includes(r) || (userDept && userDept.includes(r))
      )
    ) {
      query = `
        SELECT s.*, k.ad_soyad as talep_eden 
        FROM satin_alma s
        LEFT JOIN kullanicilar k ON s.talep_eden_id = k.id
        ORDER BY s.id DESC
      `;
    } else {
      // Diğerleri sadece KENDİ DEPARTMANINI görür
      query = `
        SELECT s.*, k.ad_soyad as talep_eden 
        FROM satin_alma s
        LEFT JOIN kullanicilar k ON s.talep_eden_id = k.id
        WHERE s.departman = $1 
        ORDER BY s.id DESC
      `;
      params = [userDept];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

// ==========================================
// 2. YENİ TALEP OLUŞTUR (GÜVENLİ 🔒)
// ==========================================
router.post("/", auth, upload.single("dosya"), async (req, res) => {
  try {
    // Talep edeni Token'dan alıyoruz. Başkası adına talep girilemez.
    const talep_eden_id = req.user.id;
    const departman = req.user.departman; // Departman da token'dan gelir

    const { baslik, aciklama, tutar, para_birimi, proje_id } = req.body;
    const dosya_yolu = req.file ? req.file.filename : null;
    const pid =
      proje_id && proje_id !== "undefined" && proje_id !== "null"
        ? proje_id
        : null;

    // A. Talebi Kaydet
    const result = await pool.query(
      "INSERT INTO satin_alma (talep_eden_id, baslik, aciklama, tutar, para_birimi, dosya_yolu, proje_id, departman, durum, finans_onayi, genel_mudur_onayi) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, 'Finans Onayı Bekliyor', false, false) RETURNING *",
      [
        talep_eden_id,
        baslik,
        aciklama,
        tutar,
        para_birimi,
        dosya_yolu,
        pid,
        departman,
      ]
    );

    // B. Bildirim: Finans Ekibine
    const finanscilar = await pool.query(
      "SELECT ad_soyad FROM kullanicilar WHERE departman IN ('Muhasebe', 'Finans')"
    );
    for (let f of finanscilar.rows) {
      await pool.query(
        "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
        [`💰 Yeni Talep: ${baslik} (${req.user.ad_soyad})`, f.ad_soyad]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("HATA:", err);
    res.status(500).send("Hata");
  }
});

// ==========================================
// 3. ONAY SİSTEMİ (GÜVENLİ 🔒)
// ==========================================
router.put("/onay/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { islem } = req.body; // Sadece "Onayla" veya "Reddet" bilgisi gelir

    // Onaylayan kişinin rolünü Token'dan alıyoruz.
    // Frontend'den "Ben Genel Müdürüm" diye data gönderse bile yemez.
    const onaylayan_rol = req.user.rol;

    const kayitSorgu = await pool.query(
      "SELECT * FROM satin_alma WHERE id = $1",
      [id]
    );
    if (kayitSorgu.rows.length === 0) return res.status(404).send("Talep yok");

    const kayit = kayitSorgu.rows[0];
    let yeniDurum = kayit.durum;
    let finansOnayi = kayit.finans_onayi;
    let gmOnayi = kayit.genel_mudur_onayi;

    // ... (Limit kontrol mantığı aynı kalabilir) ...
    const tutar = parseFloat(kayit.tutar);
    const birim = kayit.para_birimi;
    let limitAsildi =
      (birim === "TL" && tutar > 10000) ||
      (birim === "USD" && tutar > 500) ||
      (birim === "EUR" && tutar > 400);

    if (islem === "Reddet") {
      yeniDurum = "Reddedildi";
    } else if (islem === "Onayla") {
      // Finansçı Onayı
      if (
        ["Finans", "Muhasebe", "Departman Müdürü"].some((r) =>
          onaylayan_rol.includes(r)
        )
      ) {
        finansOnayi = true;
        yeniDurum = limitAsildi
          ? "Genel Müdür Onayı Bekliyor"
          : "Onaylandı (Satın Alınacak)";
      }
      // GM Onayı
      if (onaylayan_rol.includes("Genel Müdür")) {
        gmOnayi = true;
        finansOnayi = true; // GM basarsa hepsi okeydir
        yeniDurum = "Onaylandı (Satın Alınacak)";
      }
    }

    await pool.query(
      "UPDATE satin_alma SET durum=$1, finans_onayi=$2, genel_mudur_onayi=$3 WHERE id=$4",
      [yeniDurum, finansOnayi, gmOnayi, id]
    );

    res.json({ message: "İşlem Başarılı" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

module.exports = router;
