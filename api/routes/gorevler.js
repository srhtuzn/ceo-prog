// api/routes/gorevler.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { upload } = require("../config/upload");
const path = require("path");

// Yardımcı Fonksiyon
async function klasorHiyerarsisiOlustur(klasorAdlari, olusturan) {
  let ustKlasorId = null;
  for (const ad of klasorAdlari) {
    if (!ad) continue;
    let sorgu = "SELECT id FROM klasorler WHERE ad = $1";
    let params = [ad];
    if (ustKlasorId) {
      sorgu += " AND ust_klasor_id = $2";
      params.push(ustKlasorId);
    } else {
      sorgu += " AND ust_klasor_id IS NULL";
    }
    const varMi = await pool.query(sorgu, params);
    if (varMi.rows.length > 0) {
      ustKlasorId = varMi.rows[0].id;
    } else {
      const yeni = await pool.query(
        "INSERT INTO klasorler (ad, ust_klasor_id, olusturan) VALUES ($1, $2, $3) RETURNING id",
        [ad, ustKlasorId, olusturan]
      );
      ustKlasorId = yeni.rows[0].id;
    }
  }
  return ustKlasorId;
}

// ==========================================
// 1. GÖREV LİSTELEME
// URL: GET /gorevler/
// ==========================================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.*, p.ad as proje_adi 
      FROM gorevler g
      LEFT JOIN projeler p ON g.proje_id = p.id
      ORDER BY g.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Sunucu hatası");
  }
});

// ==========================================
// 2. TEK GÖREV GETİR
// URL: GET /gorevler/:id
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Eğer gelen id "projeler" ise (çakışma kontrolü) burayı atla
    if (id === "projeler") return;

    const result = await pool.query(
      `SELECT g.*, p.ad as proje_adi FROM gorevler g LEFT JOIN projeler p ON g.proje_id = p.id WHERE g.id = $1`,
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Görev bulunamadı" });
    res.json(result.rows[0]);
  } catch (err) {
    // ID sayı değilse (örn: /gorevler/projeler çağrıldıysa) hata vermesin diye
    if (err.code === "22P02") return res.status(404).send("Geçersiz ID");
    console.error(err.message);
    res.status(500).send("Sunucu hatası");
  }
});

// ==========================================
// 3. GÖREV EKLEME
// URL: POST /gorevler/
// ==========================================
router.post("/", upload.array("dosyalar", 10), async (req, res) => {
  try {
    const {
      baslik,
      aciklama,
      oncelik,
      tarih,
      atananlar,
      gozlemciler,
      proje_id,
      tekrar_tipi,
    } = req.body;

    let atananlarParsed = atananlar ? JSON.parse(atananlar) : [];
    let gozlemcilerParsed = gozlemciler ? JSON.parse(gozlemciler) : [];
    const pid =
      proje_id && proje_id !== "null" && proje_id !== "undefined"
        ? proje_id
        : null;

    const dosya_yolu_db =
      req.files && req.files.length > 0
        ? req.files.length === 1
          ? req.files[0].filename
          : "COKLU_DOSYA"
        : null;

    const result = await pool.query(
      "INSERT INTO gorevler (baslik, aciklama, oncelik, tarih, durum, atananlar, gozlemciler, dosya_yolu, proje_id, tekrar_tipi) VALUES ($1, $2, $3, $4, 'Bekliyor', $5, $6, $7, $8, $9) RETURNING *",
      [
        baslik,
        aciklama,
        oncelik,
        tarih,
        atananlarParsed,
        gozlemcilerParsed,
        dosya_yolu_db,
        pid,
        tekrar_tipi || "Tek Seferlik",
      ]
    );
    const yeniGorevId = result.rows[0].id;

    // DRIVE ENTEGRASYONU
    if (req.files && req.files.length > 0) {
      const olusturanKisi = "Sistem";
      let hedefKlasorId = null;
      let anaRotaKlasorId = null;

      if (pid) {
        const projeBilgi = await pool.query(
          "SELECT ad, departman FROM projeler WHERE id = $1",
          [pid]
        );
        if (projeBilgi.rows.length > 0) {
          const { ad: projeAdi, departman: projeDepartman } =
            projeBilgi.rows[0];
          anaRotaKlasorId = await klasorHiyerarsisiOlustur(
            [projeDepartman, projeAdi],
            olusturanKisi
          );
        }
      } else {
        anaRotaKlasorId = await klasorHiyerarsisiOlustur(
          ["Genel Görevler"],
          olusturanKisi
        );
      }

      if (req.files.length > 1) {
        const gorevKlasorAdi = `#${yeniGorevId} - ${baslik}`;
        const gorevKlasorRes = await pool.query(
          "INSERT INTO klasorler (ad, ust_klasor_id, olusturan) VALUES ($1, $2, $3) RETURNING id",
          [gorevKlasorAdi, anaRotaKlasorId, olusturanKisi]
        );
        hedefKlasorId = gorevKlasorRes.rows[0].id;
      } else {
        hedefKlasorId = anaRotaKlasorId;
      }

      for (const file of req.files) {
        let finalAd = file.originalname;
        if (req.files.length === 1)
          finalAd = `#${yeniGorevId} - ${file.originalname}`;

        await pool.query(
          "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, yukleyen, klasor_id, tarih) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
          [
            finalAd,
            file.filename,
            file.filename,
            path.extname(file.originalname),
            file.size,
            "Görev Sistemi",
            hedefKlasorId,
          ]
        );
      }
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("KAYIT HATASI:", err.message);
    res.status(500).send(err.message);
  }
});

// ==========================================
// 4. GÖREV GÜNCELLEME
// URL: PUT /gorevler/:id
// ==========================================
router.put("/:id", upload.single("dosya"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      baslik,
      aciklama,
      oncelik,
      tarih,
      durum,
      atananlar,
      gozlemciler,
      proje_id,
      tekrar_tipi,
    } = req.body;
    const yeni_dosya_yolu = req.file ? req.file.filename : undefined;

    const eskiGorevSorgu = await pool.query(
      "SELECT * FROM gorevler WHERE id = $1",
      [id]
    );
    if (eskiGorevSorgu.rows.length === 0)
      return res.status(404).json({ error: "Görev yok" });
    const eskiGorev = eskiGorevSorgu.rows[0];

    let atananlarParsed = eskiGorev.atananlar;
    let gozlemcilerParsed = eskiGorev.gozlemciler;
    try {
      if (atananlar !== undefined)
        atananlarParsed = atananlar
          ? JSON.parse(atananlar)
          : eskiGorev.atananlar;
      if (gozlemciler !== undefined)
        gozlemcilerParsed = gozlemciler
          ? JSON.parse(gozlemciler)
          : eskiGorev.gozlemciler;
    } catch (e) {}

    const y_baslik = baslik !== undefined ? baslik : eskiGorev.baslik;
    const y_aciklama = aciklama !== undefined ? aciklama : eskiGorev.aciklama;
    const y_oncelik = oncelik !== undefined ? oncelik : eskiGorev.oncelik;
    const y_tarih = tarih !== undefined ? tarih : eskiGorev.tarih;
    const y_durum = durum !== undefined ? durum : eskiGorev.durum;
    const y_proje_id =
      proje_id && proje_id !== "null" ? proje_id : eskiGorev.proje_id;
    const y_tekrar_tipi =
      tekrar_tipi !== undefined ? tekrar_tipi : eskiGorev.tekrar_tipi;
    const y_dosya_yolu =
      yeni_dosya_yolu !== undefined ? yeni_dosya_yolu : eskiGorev.dosya_yolu;

    await pool.query(
      `UPDATE gorevler SET baslik=$1, aciklama=$2, oncelik=$3, tarih=$4, durum=$5, atananlar=$6, gozlemciler=$7, proje_id=$8, tekrar_tipi=$9, dosya_yolu=$10 WHERE id=$11`,
      [
        y_baslik,
        y_aciklama,
        y_oncelik,
        y_tarih,
        y_durum,
        atananlarParsed,
        gozlemcilerParsed,
        y_proje_id,
        y_tekrar_tipi,
        y_dosya_yolu,
        id,
      ]
    );

    if (req.file) {
      await pool.query(
        `INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, yukleyen, tarih) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          req.file.originalname,
          req.file.filename,
          req.file.filename,
          path.extname(req.file.originalname),
          req.file.size,
          "Görev Sistemi",
        ]
      );
    }

    // Bildirimler
    if (y_durum !== eskiGorev.durum) {
      let msg = "";
      if (y_durum === "Onay Bekliyor") msg = `⚠️ "${y_baslik}" onaya sunuldu.`;
      else if (y_durum === "Yapıldı") msg = `✅ "${y_baslik}" tamamlandı.`;
      else if (y_durum === "Bekliyor" && eskiGorev.durum === "Onay Bekliyor")
        msg = `❌ "${y_baslik}" reddedildi.`;

      if (msg)
        await pool.query(
          "INSERT INTO bildirimler (mesaj, kime, gorev_id) VALUES ($1, $2, $3)",
          [msg, "İlgililer", id]
        );
    }

    const finalResult = await pool.query(
      `SELECT g.*, p.ad as proje_adi FROM gorevler g LEFT JOIN projeler p ON g.proje_id = p.id WHERE g.id = $1`,
      [id]
    );
    res.json(finalResult.rows[0]);
  } catch (err) {
    console.error("GÜNCELLEME HATASI:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. GÖREV SİLME
// URL: DELETE /gorevler/:id
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const gorevSorgu = await pool.query(
      "SELECT dosya_yolu FROM gorevler WHERE id = $1",
      [id]
    );
    if (gorevSorgu.rows.length === 0)
      return res.status(404).json({ error: "Görev bulunamadı" });
    await pool.query("DELETE FROM gorevler WHERE id = $1", [id]);
    res.json({ mesaj: "Görev silindi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Silme hatası" });
  }
});

// ==========================================
// 6. YORUMLAR
// URL: /gorevler/:id/yorumlar
// ==========================================
router.get("/:id/yorumlar", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM yorumlar WHERE gorev_id = $1 ORDER BY tarih ASC",
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
  }
});

router.post("/:id/yorumlar", async (req, res) => {
  try {
    const { id } = req.params;
    const { yazan_kisi, mesaj } = req.body;
    const result = await pool.query(
      "INSERT INTO yorumlar (gorev_id, yazan_kisi, mesaj) VALUES ($1, $2, $3) RETURNING *",
      [id, yazan_kisi, mesaj]
    );

    let bildirimMesajı = `💬 ${yazan_kisi} bir yorum yazdı.`;
    if (mesaj.includes("@"))
      bildirimMesajı = `📣 ${yazan_kisi} senden bahsetti!`;
    await pool.query(
      "INSERT INTO bildirimler (mesaj, kime, gorev_id) VALUES ($1, $2, $3)",
      [bildirimMesajı, "İlgililer", id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
  }
});

// ==========================================
// 7. ALT GÖREVLER
// URL: /gorevler/:id/alt-gorevler
// ==========================================
router.get("/:id/alt-gorevler", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM alt_gorevler WHERE gorev_id = $1 ORDER BY id ASC",
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
  }
});

router.post("/:id/alt-gorevler", async (req, res) => {
  try {
    const { baslik, olusturan } = req.body;
    const result = await pool.query(
      "INSERT INTO alt_gorevler (gorev_id, baslik, olusturan) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, baslik, olusturan]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// Not: Bu ikisi ID bazlı olduğu için gorev id'ye bağımlı değil, olduğu gibi kalabilir veya genel bir route'a taşınabilir.
// Şimdilik burada bırakıyoruz ama frontend erişirken /gorevler/alt-gorevler/:id diyecek.
router.put("/alt-gorevler/:id", async (req, res) => {
  try {
    const { durum } = req.body;
    await pool.query("UPDATE alt_gorevler SET durum = $1 WHERE id = $2", [
      durum,
      req.params.id,
    ]);
    res.json({ message: "Güncellendi" });
  } catch (err) {
    console.error(err.message);
  }
});

router.delete("/alt-gorevler/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM alt_gorevler WHERE id = $1", [req.params.id]);
    res.json({ message: "Silindi" });
  } catch (err) {
    console.error(err.message);
  }
});

// ==========================================
// 8. PROJELER (ÖZEL DURUM)
// URL: /gorevler/projeler (Çünkü gorevler.js içine koyduk)
// ==========================================
router.get("/projeler", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM projeler ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
  }
});

router.post("/projeler", async (req, res) => {
  try {
    const { ad, departman, baslangic_tarihi, bitis_tarihi, olusturan } =
      req.body;
    const result = await pool.query(
      "INSERT INTO projeler (ad, departman, baslangic_tarihi, bitis_tarihi, olusturan) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [ad, departman, baslangic_tarihi, bitis_tarihi, olusturan]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
  }
});

// 9. PROJE SİLME (Güvenli Silme)
// URL: DELETE /gorevler/projeler/:id
// ==========================================
router.delete("/projeler/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Önce bu projeye bağlı görevlerin proje_id'sini NULL yap (Görevler silinmesin)
    await pool.query(
      "UPDATE gorevler SET proje_id = NULL WHERE proje_id = $1",
      [id]
    );

    // 2. Projeyi sil
    await pool.query("DELETE FROM projeler WHERE id = $1", [id]);

    res.json({ message: "Proje silindi, bağlı görevler serbest bırakıldı." });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Proje silme hatası");
  }
});

module.exports = router;
