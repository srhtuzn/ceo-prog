const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const multer = require("multer");
const path = require("path");

// MULTER
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, "proforma-" + uniqueSuffix);
  },
});
const upload = multer({ storage });

// ==========================================
// 1. TALEPLERİ GETİR
// ==========================================
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.json([]);

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
      query = `
        SELECT s.*, k.ad_soyad as talep_eden 
        FROM satin_alma s
        LEFT JOIN kullanicilar k ON s.talep_eden_id = k.id
        ORDER BY s.id DESC
      `;
    } else {
      // Diğerleri kendi departmanını görür
      query = `
        SELECT s.*, k.ad_soyad as talep_eden 
        FROM satin_alma s
        LEFT JOIN kullanicilar k ON s.talep_eden_id = k.id
        WHERE s.departman = $1 
        ORDER BY s.id DESC
      `;
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
      talep_eden_id,
      baslik,
      aciklama,
      tutar,
      para_birimi,
      proje_id,
      departman,
    } = req.body;
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

    // B. Bildirim: Finans Ekibine (İsim ile Gönderiyoruz)
    // Finans/Muhasebe departmanındaki kişilerin adlarını bul
    const finanscilar = await pool.query(
      "SELECT ad_soyad FROM kullanicilar WHERE departman = 'Muhasebe' OR departman = 'Finans'"
    );

    for (let f of finanscilar.rows) {
      // HATA DÜZELTİLDİ: kime_id yerine kime (string) kullanıyoruz.
      await pool.query(
        "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
        [`💰 Yeni Satın Alma Talebi: ${baslik}`, f.ad_soyad]
      );
    }

    // Opsiyonel: Genel Müdüre de atılabilir
    const gmler = await pool.query(
      "SELECT ad_soyad FROM kullanicilar WHERE rol = 'Genel Müdür'"
    );
    for (let gm of gmler.rows) {
      await pool.query(
        "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
        [`💰 Yeni Satın Alma Talebi: ${baslik}`, gm.ad_soyad]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("SATIN ALMA EKLEME HATASI:", err);
    res.status(500).send("Hata");
  }
});

// ==========================================
// 3. ONAY SİSTEMİ
// ==========================================
router.put("/onay/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { onaylayan_rol, islem } = req.body;

    const kayitSorgu = await pool.query(
      "SELECT * FROM satin_alma WHERE id = $1",
      [id]
    );
    const kayit = kayitSorgu.rows[0];

    let yeniDurum = kayit.durum;
    let finansOnayi = kayit.finans_onayi;
    let gmOnayi = kayit.genel_mudur_onayi;

    // Limit Kontrolü
    const tutar = parseFloat(kayit.tutar);
    const birim = kayit.para_birimi;
    let limitAsildi = false;
    if (birim === "TL" && tutar > 10000) limitAsildi = true;
    else if (birim === "USD" && tutar > 250) limitAsildi = true;
    else if (birim === "EUR" && tutar > 200) limitAsildi = true;

    if (islem === "Reddet") {
      yeniDurum = "Reddedildi";
      if (
        onaylayan_rol.includes("Finans") ||
        onaylayan_rol.includes("Muhasebe")
      )
        finansOnayi = false;
      if (onaylayan_rol.includes("Genel Müdür")) gmOnayi = false;
    } else if (islem === "Onayla") {
      if (
        onaylayan_rol.includes("Finans") ||
        onaylayan_rol.includes("Muhasebe") ||
        onaylayan_rol.includes("Departman Müdürü")
      ) {
        finansOnayi = true;
        if (limitAsildi) {
          yeniDurum = "Genel Müdür Onayı Bekliyor";
          // GM'ye Bildirim (İsim ile)
          const gmler = await pool.query(
            "SELECT ad_soyad FROM kullanicilar WHERE rol = 'Genel Müdür'"
          );
          for (let gm of gmler.rows) {
            await pool.query(
              "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
              [`📝 GM Onayı Gereken Satın Alma: ${kayit.baslik}`, gm.ad_soyad]
            );
          }
        } else {
          yeniDurum = "Onaylandı (Satın Alınacak)";
        }
      }
      if (onaylayan_rol.includes("Genel Müdür")) {
        gmOnayi = true;
        finansOnayi = true;
        yeniDurum = "Onaylandı (Satın Alınacak)";
      }
    }

    await pool.query(
      "UPDATE satin_alma SET durum=$1, finans_onayi=$2, genel_mudur_onayi=$3 WHERE id=$4",
      [yeniDurum, finansOnayi, gmOnayi, id]
    );

    // Talep Edene Bildirim (İsim bularak)
    const talepEdenId = kayit.talep_eden_id;
    if (talepEdenId) {
      const userRes = await pool.query(
        "SELECT ad_soyad FROM kullanicilar WHERE id=$1",
        [talepEdenId]
      );
      if (userRes.rows.length > 0) {
        const adSoyad = userRes.rows[0].ad_soyad;
        let msg = yeniDurum.includes("Onaylandı")
          ? `✅ Satın alma onaylandı: ${kayit.baslik}`
          : `👍 Durum: ${yeniDurum}`;
        await pool.query(
          "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
          [msg, adSoyad]
        );
      }
    }

    res.json({ message: "İşlem Başarılı" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

module.exports = router;
