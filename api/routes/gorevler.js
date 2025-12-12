const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { upload } = require("../config/upload");
const path = require("path");
const auth = require("../middleware/authMiddleware"); // <--- GÜVENLİK EKLENDİ

// --- YARDIMCI FONKSİYON: Klasör Zinciri Oluştur ---
async function klasorHiyerarsisiOlustur(klasorAdlari, olusturan_id) {
  let ustKlasorId = null;
  for (const ad of klasorAdlari) {
    if (!ad) continue;

    let sorgu = "SELECT id FROM klasorler WHERE ad = $1 AND silindi = FALSE";
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
      const creatorId = olusturan_id ? parseInt(olusturan_id) : 1;
      const yeni = await pool.query(
        "INSERT INTO klasorler (ad, ust_klasor_id, olusturan_id) VALUES ($1, $2, $3) RETURNING id",
        [ad, ustKlasorId, creatorId]
      );
      ustKlasorId = yeni.rows[0].id;
    }
  }
  return ustKlasorId;
}

// ==========================================
// PROJE ROTALARI
// ==========================================

router.get("/projeler", auth, async (req, res) => {
  try {
    const result = await pool.query(`
        SELECT p.*, k.ad_soyad as olusturan_adi 
        FROM projeler p 
        LEFT JOIN kullanicilar k ON p.olusturan_id = k.id 
        ORDER BY p.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

router.post("/projeler", auth, async (req, res) => {
  try {
    const { ad, departman, baslangic_tarihi, bitis_tarihi } = req.body;
    const olusturan_id = req.user.id; // Token'dan al

    const result = await pool.query(
      "INSERT INTO projeler (ad, departman, baslangic_tarihi, bitis_tarihi, olusturan_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [ad, departman, baslangic_tarihi, bitis_tarihi, olusturan_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

router.delete("/projeler/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE gorevler SET proje_id = NULL WHERE proje_id = $1",
      [id]
    );
    await pool.query("DELETE FROM projeler WHERE id = $1", [id]);
    res.json({ message: "Proje silindi" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

// ==========================================
// GÖREV ROTALARI
// ==========================================

// 1. GÖREV LİSTELEME (GÜNCELLENDİ: İlişkisel Veri 🔗)
router.get("/", auth, async (req, res) => {
  try {
    // Bu sorgu, atanan kişileri JSON listesi olarak tek seferde getirir
    const query = `
      SELECT 
        g.*, 
        p.ad as proje_adi, 
        k.ad_soyad as olusturan_adi, 
        k.avatar as olusturan_avatar,
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', u.id, 'ad_soyad', u.ad_soyad, 'avatar', u.avatar))
            FROM gorev_atamalari ga
            JOIN kullanicilar u ON ga.kullanici_id = u.id
            WHERE ga.gorev_id = g.id
          ), 
          '[]'
        ) as atananlar_listesi
      FROM gorevler g
      LEFT JOIN projeler p ON g.proje_id = p.id
      LEFT JOIN kullanicilar k ON g.olusturan_id = k.id
      ORDER BY g.id DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

// 2. TEK GÖREV GETİR
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ error: "Geçersiz ID" });

    // Görev ve Atanan ID'ler
    const query = `
      SELECT 
        g.*, 
        p.ad as proje_adi,
        COALESCE(
          (
            SELECT json_agg(u.id) -- Formda seçili göstermek için sadece ID lazım
            FROM gorev_atamalari ga
            JOIN kullanicilar u ON ga.kullanici_id = u.id
            WHERE ga.gorev_id = g.id
          ), 
          '[]'
        ) as atananlar_ids
      FROM gorevler g 
      LEFT JOIN projeler p ON g.proje_id = p.id 
      WHERE g.id = $1
    `;

    const gorevRes = await pool.query(query, [id]);
    if (gorevRes.rows.length === 0)
      return res.status(404).json({ error: "Görev bulunamadı" });

    // Dosyaları Getir
    const dosyaRes = await pool.query(
      "SELECT * FROM dosyalar WHERE ad LIKE $1 AND silindi = FALSE",
      [`#${id} -%`]
    );

    const gorev = {
      ...gorevRes.rows[0],
      dosyalar: dosyaRes.rows,
    };

    res.json(gorev);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

// 3. GÖREV EKLEME (TRANSACTION & İLİŞKİSEL TABLO ✅)
router.post("/", auth, upload.array("dosyalar"), async (req, res) => {
  const client = await pool.connect(); // Transaction için client gerekli
  try {
    const {
      baslik,
      aciklama,
      oncelik,
      tarih,
      atananlar, // Artık ID listesi geliyor: "[1, 5, 8]"
      gozlemciler,
      proje_id,
      tekrar_tipi,
    } = req.body;

    const olusturan_id = req.user.id; // Güvenli ID

    await client.query("BEGIN"); // İşlemi başlat

    // A. Görevi Kaydet
    const result = await client.query(
      "INSERT INTO gorevler (baslik, aciklama, oncelik, tarih, durum, gozlemciler, proje_id, tekrar_tipi, olusturan_id) VALUES ($1, $2, $3, $4, 'Bekliyor', $5, $6, $7, $8) RETURNING *",
      [
        baslik,
        aciklama,
        oncelik,
        tarih,
        JSON.parse(gozlemciler || "[]"),
        proje_id || null,
        tekrar_tipi || "Tek Seferlik",
        olusturan_id,
      ]
    );
    const yeniGorevId = result.rows[0].id;

    // B. Atamaları İlişki Tablosuna Kaydet (gorev_atamalari)
    if (atananlar) {
      const ids = Array.isArray(atananlar)
        ? atananlar
        : JSON.parse(atananlar || "[]");

      for (const uid of ids) {
        await client.query(
          "INSERT INTO gorev_atamalari (gorev_id, kullanici_id) VALUES ($1, $2)",
          [yeniGorevId, uid]
        );
      }
    }

    // C. Dosya İşlemleri (Drive)
    if (req.files && req.files.length > 0) {
      let yol = ["Genel Görevler"];
      if (proje_id) {
        // Transaction içinde olduğumuz için pool yerine client kullansak daha iyi ama okuma yapıyoruz, sorun yok.
        const prj = await client.query(
          "SELECT ad, departman FROM projeler WHERE id=$1",
          [proje_id]
        );
        if (prj.rows.length > 0) {
          yol = [prj.rows[0].departman, prj.rows[0].ad];
        }
      }

      // Klasör bul/oluştur (Transaction dışında çalışan yardımcı fonk. kullanıyoruz, sorun değil)
      const hedefKlasorId = await klasorHiyerarsisiOlustur(yol, olusturan_id);

      for (const file of req.files) {
        const finalAd = `#${yeniGorevId} - ${file.originalname}`;

        await client.query(
          "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, yukleyen_id, klasor_id, tarih) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
          [
            finalAd,
            file.filename,
            file.filename,
            path.extname(file.originalname),
            file.size,
            olusturan_id,
            hedefKlasorId,
          ]
        );
      }

      // Dosya ikonunu güncelle
      const dosyaYoluStr =
        req.files.length > 1 ? "COKLU_DOSYA" : req.files[0].filename;
      await client.query("UPDATE gorevler SET dosya_yolu = $1 WHERE id = $2", [
        dosyaYoluStr,
        yeniGorevId,
      ]);
      result.rows[0].dosya_yolu = dosyaYoluStr;
    }

    await client.query("COMMIT"); // Her şey yolunda, kaydet
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK"); // Hata oldu, her şeyi geri al
    console.error("GÖREV EKLEME HATASI:", err.message);
    res.status(500).send(err.message);
  } finally {
    client.release();
  }
});

// 4. GÖREV GÜNCELLEME
router.put("/:id", auth, upload.array("dosyalar"), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      baslik,
      aciklama,
      oncelik,
      durum,
      proje_id,
      atananlar, // ID Listesi
    } = req.body;

    await client.query("BEGIN");

    // Görevi Güncelle
    await client.query(
      "UPDATE gorevler SET baslik=$1, aciklama=$2, oncelik=$3, durum=$4, proje_id=$5 WHERE id=$6",
      [baslik, aciklama, oncelik, durum, proje_id || null, id]
    );

    // Atamaları Güncelle (Sil ve Yeniden Ekle Yöntemi)
    if (atananlar) {
      const ids = Array.isArray(atananlar)
        ? atananlar
        : JSON.parse(atananlar || "[]");

      // Önce eskileri temizle
      await client.query("DELETE FROM gorev_atamalari WHERE gorev_id = $1", [
        id,
      ]);

      // Yenileri ekle
      for (const uid of ids) {
        await client.query(
          "INSERT INTO gorev_atamalari (gorev_id, kullanici_id) VALUES ($1, $2)",
          [id, uid]
        );
      }
    }

    // Dosya Ekleme
    if (req.files && req.files.length > 0) {
      const olusturan_id = req.user.id;
      let yol = ["Genel Görevler"];
      if (proje_id) {
        const prj = await client.query(
          "SELECT ad, departman FROM projeler WHERE id=$1",
          [proje_id]
        );
        if (prj.rows.length > 0) yol = [prj.rows[0].departman, prj.rows[0].ad];
      }
      const hedefKlasorId = await klasorHiyerarsisiOlustur(yol, olusturan_id);

      for (const file of req.files) {
        const finalAd = `#${id} - ${file.originalname}`;
        await client.query(
          "INSERT INTO dosyalar (ad, fiziksel_ad, dosya_yolu, uzanti, boyut, yukleyen_id, klasor_id, tarih) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
          [
            finalAd,
            file.filename,
            file.filename,
            path.extname(file.originalname),
            file.size,
            olusturan_id,
            hedefKlasorId,
          ]
        );
      }
      await client.query(
        "UPDATE gorevler SET dosya_yolu = 'VAR' WHERE id = $1",
        [id]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Güncellendi" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).send("Hata");
  } finally {
    client.release();
  }
});

// 5. GÖREV SİLME
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    // Dosyaları ve klasörleri 'silindi' işaretle
    await pool.query("UPDATE klasorler SET silindi = TRUE WHERE ad LIKE $1", [
      `#${id} -%`,
    ]);
    await pool.query("UPDATE dosyalar SET silindi = TRUE WHERE ad LIKE $1", [
      `#${id} -%`,
    ]);
    // Görevi sil (Cascade sayesinde atamalar ve yorumlar da silinir)
    await pool.query("DELETE FROM gorevler WHERE id = $1", [id]);
    res.json({ message: "Görev silindi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Silme hatası" });
  }
});

// 6. YORUMLAR
router.get("/:id/yorumlar", auth, async (req, res) => {
  try {
    const r = await pool.query(
      `
        SELECT y.*, k.ad_soyad as yazan_kisi_adi, k.avatar as yazan_kisi_avatar
        FROM yorumlar y
        LEFT JOIN kullanicilar k ON y.yazan_kisi_id = k.id
        WHERE y.gorev_id = $1 ORDER BY y.tarih ASC
    `,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
  }
});

router.post("/:id/yorumlar", auth, async (req, res) => {
  try {
    const { mesaj } = req.body;
    const yazan_kisi_id = req.user.id; // Token'dan al

    const r = await pool.query(
      "INSERT INTO yorumlar (gorev_id, yazan_kisi_id, mesaj) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, yazan_kisi_id, mesaj]
    );

    // Bildirim
    await pool.query(
      "INSERT INTO bildirimler (mesaj, kime, gorev_id) VALUES ($1, $2, $3)",
      [`💬 ${req.user.ad_soyad} yorum yaptı`, "İlgililer", req.params.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
  }
});

// 7. ALT GÖREVLER
router.get("/:id/alt-gorevler", auth, async (req, res) => {
  try {
    const r = await pool.query(
      `
        SELECT a.*, k.ad_soyad as olusturan_adi
        FROM alt_gorevler a
        LEFT JOIN kullanicilar k ON a.olusturan_id = k.id
        WHERE a.gorev_id = $1 ORDER BY a.id ASC
    `,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
  }
});

router.post("/:id/alt-gorevler", auth, async (req, res) => {
  try {
    const { baslik } = req.body;
    const olusturan_id = req.user.id; // Token'dan al

    const r = await pool.query(
      "INSERT INTO alt_gorevler (gorev_id, baslik, olusturan_id) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, baslik, olusturan_id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Hata");
  }
});

router.put("/alt-gorevler/:id", auth, async (req, res) => {
  try {
    await pool.query("UPDATE alt_gorevler SET durum = $1 WHERE id = $2", [
      req.body.durum,
      req.params.id,
    ]);
    res.json({ message: "Ok" });
  } catch (err) {
    console.error(err);
  }
});

router.delete("/alt-gorevler/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM alt_gorevler WHERE id = $1", [req.params.id]);
    res.json({ message: "Silindi" });
  } catch (err) {
    console.error(err);
  }
});

module.exports = router;
