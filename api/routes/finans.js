const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const multer = require("multer");
const path = require("path");

// -----------------------------------------
// MULTER AYARI
// -----------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, "proforma-" + uniqueSuffix);
  },
});
const upload = multer({ storage });

// ==========================================
// 1. TALEPLERİ GETİR (DEPARTMAN FİLTRESİ)
// ==========================================
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.json([]);

    // Kullanıcı bilgisi
    const userRes = await pool.query(
      "SELECT * FROM kullanicilar WHERE id = $1",
      [userId]
    );
    if (userRes.rows.length === 0) return res.json([]);

    const user = userRes.rows[0];

    let query = "";
    let params = [];

    // Yönetici roller HER ŞEYİ görür
    if (
      ["Genel Müdür", "Yönetim", "Finans", "Muhasebe"].some(
        (r) => user.rol.includes(r) || user.departman.includes(r)
      )
    ) {
      query = "SELECT * FROM satin_alma ORDER BY id DESC";
    } else {
      // Diğerleri kendi departmanını görür
      query = "SELECT * FROM satin_alma WHERE departman = $1 ORDER BY id DESC";
      params = [user.departman];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

// ==========================================
// 2. YENİ SATIN ALMA TALEBİ OLUŞTUR
// ==========================================
router.post("/", upload.single("dosya"), async (req, res) => {
  try {
    const {
      talep_eden,
      baslik,
      aciklama,
      tutar,
      para_birimi,
      proje_id,
      departman,
    } = req.body;

    const dosya_yolu = req.file ? req.file.filename : null;

    // Proje opsiyonel
    const pid =
      proje_id && proje_id !== "undefined" && proje_id !== "null"
        ? proje_id
        : null;

    const result = await pool.query(
      "INSERT INTO satin_alma (talep_eden, baslik, aciklama, tutar, para_birimi, dosya_yolu, proje_id, departman) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [
        talep_eden,
        baslik,
        aciklama,
        tutar,
        para_birimi,
        dosya_yolu,
        pid,
        departman,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

// ==========================================
// 3. ONAY SİSTEMİ (Finans → GM → Final)
// ==========================================
router.put("/onay/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { onaylayan_rol, islem } = req.body;

    // Kayıt getir
    const kayitSorgu = await pool.query(
      "SELECT * FROM satin_alma WHERE id = $1",
      [id]
    );
    const kayit = kayitSorgu.rows[0];

    let yeniDurum = kayit.durum;
    let finansOnayi = kayit.finans_onayi;
    let gmOnayi = kayit.genel_mudur_onayi;

    // -----------------------------------------
    // SENARYO A: REDDEDİLDİ
    // -----------------------------------------
    if (islem === "Reddet") {
      yeniDurum = "Reddedildi";
      if (
        onaylayan_rol.includes("Finans") ||
        onaylayan_rol.includes("Muhasebe")
      )
        finansOnayi = false;

      if (onaylayan_rol.includes("Genel Müdür")) gmOnayi = false;
    }

    // -----------------------------------------
    // SENARYO B: ONAYLANDI
    // -----------------------------------------
    else if (islem === "Onayla") {
      // Finans / Muhasebe onayı
      if (
        onaylayan_rol.includes("Finans") ||
        onaylayan_rol.includes("Muhasebe")
      ) {
        finansOnayi = true;

        // 10.000 TL altı → direkt onay
        if (parseFloat(kayit.tutar) <= 10000) {
          yeniDurum = "Onaylandı (Satın Alınacak)";
        } else {
          // 10.000 üstü → GM onayı gerekir
          yeniDurum = "Genel Müdür Onayı Bekliyor";
        }
      }

      // Genel Müdür onayı
      if (onaylayan_rol.includes("Genel Müdür")) {
        gmOnayi = true;
        yeniDurum = "Onaylandı (Satın Alınacak)";
      }
    }

    // Final update
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
