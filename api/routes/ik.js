// api/routes/ik.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ==========================================
// KULLANICI YÖNETİMİ
// ==========================================

// Tüm kullanıcıları getir
router.get("/kullanicilar", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, ad_soyad, email, departman, pozisyon, rol, hesap_durumu, avatar FROM kullanicilar ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Sunucu hatası");
  }
});

// Kullanıcı bilgilerini güncelle
router.put("/kullanicilar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ad_soyad,
      departman,
      pozisyon,
      rol,
      hesap_durumu,
      toplam_izin_hakki,
    } = req.body;

    const update = await pool.query(
      "UPDATE kullanicilar SET ad_soyad=$1, departman=$2, pozisyon=$3, rol=$4, hesap_durumu=$5, toplam_izin_hakki=$6 WHERE id=$7 RETURNING *",
      [ad_soyad, departman, pozisyon, rol, hesap_durumu, toplam_izin_hakki, id]
    );

    res.json(update.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Güncelleme hatası");
  }
});

// Kullanıcı sil
router.delete("/kullanicilar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM kullanicilar WHERE id = $1", [id]);
    res.json({ message: "Kullanıcı silindi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Silme hatası");
  }
});

// Yönetici ata
router.put("/kullanicilar/yonetici-ata/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { yonetici_id } = req.body;

    await pool.query("UPDATE kullanicilar SET yonetici_id = $1 WHERE id = $2", [
      yonetici_id,
      id,
    ]);
    res.json({ message: "Yönetici atandı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// Yönetici rolünü kaldır
router.put("/kullanicilar/yonetici-sil/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE kullanicilar SET yonetici_id = NULL WHERE id = $1",
      [id]
    );
    res.json({ message: "Yönetici bağlantısı kaldırıldı" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// ==========================================
// İZİN YÖNETİMİ
// ==========================================

// Tüm izinleri listele (PERSONEL GİZLİLİĞİ EKLENDİ 🔒)
router.get("/izinler", async (req, res) => {
  try {
    const { userId } = req.query; // Frontend'den userId geliyor

    // Kullanıcı rolünü bul
    const userRes = await pool.query(
      "SELECT rol, ad_soyad FROM kullanicilar WHERE id = $1",
      [userId]
    );
    if (userRes.rows.length === 0) return res.json([]);

    const user = userRes.rows[0];
    let query = "";
    let params = [];

    // Eğer Yönetici, GM veya İK ise HERKESİ görsün
    if (
      [
        "Genel Müdür",
        "İnsan Kaynakları",
        "Yönetim",
        "Departman Müdürü",
        "Süpervizör",
      ].some((r) => user.rol.includes(r))
    ) {
      query = "SELECT * FROM izinler ORDER BY baslangic_tarihi DESC";
    } else {
      // Değilse (Personel) SADECE KENDİNİ görsün
      query =
        "SELECT * FROM izinler WHERE talep_eden = $1 ORDER BY baslangic_tarihi DESC";
      params = [user.ad_soyad];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Sunucu hatası");
  }
});

// Yeni izin talebi oluştur (DÜZELTİLDİ: Sütun isimleri şemaya uygun)
router.post("/izinler", async (req, res) => {
  try {
    const {
      ad_soyad,
      baslangic_tarihi,
      bitis_tarihi,
      aciklama,
      turu,
      gun_sayisi,
    } = req.body;

    // 1. Önce talep edenin DEPARTMANINI bul
    const userRes = await pool.query(
      "SELECT departman FROM kullanicilar WHERE ad_soyad = $1",
      [ad_soyad]
    );
    let departman = "Genel"; // Varsayılan
    if (userRes.rows.length > 0) {
      departman = userRes.rows[0].departman;
    }

    // 2. Kaydı oluştur
    const insert = await pool.query(
      "INSERT INTO izinler (talep_eden, baslangic_tarihi, bitis_tarihi, aciklama, tur, durum, gun_sayisi, departman) VALUES ($1, $2, $3, $4, $5, 'Yönetici Onayı Bekliyor', $6, $7) RETURNING *",
      [
        ad_soyad,
        baslangic_tarihi,
        bitis_tarihi,
        aciklama,
        turu,
        gun_sayisi,
        departman,
      ]
    );

    // 3. BİLDİRİMİ KİME GÖNDERELİM?
    // A. O departmanın müdürlerini bul
    const mudurler = await pool.query(
      "SELECT ad_soyad FROM kullanicilar WHERE departman = $1 AND rol = 'Departman Müdürü'",
      [departman]
    );

    // B. Bildirim metni
    const bildirim = `📅 ${ad_soyad} (${departman}) izin talep etti. Onay bekleniyor.`;

    // C. Müdürlere gönder
    for (let mudur of mudurler.rows) {
      await pool.query(
        "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
        [bildirim, mudur.ad_soyad]
      );
    }

    // D. Genel Müdüre de gönder (Opsiyonel ama iyi olur)
    const gmler = await pool.query(
      "SELECT ad_soyad FROM kullanicilar WHERE rol = 'Genel Müdür'"
    );
    for (let gm of gmler.rows) {
      await pool.query(
        "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
        [bildirim, gm.ad_soyad]
      );
    }

    res.json(insert.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});
// İzin talebini iptal et
router.put("/izinler/iptal/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE izinler SET durum = 'İptal Edildi' WHERE id = $1",
      [id]
    );
    res.json({ message: "İzin iptal edildi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// İzin onayla veya reddet (ŞEMA GÜNCELLEMESİ)
router.put("/izinler/onay/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { islem, onaylayan_rol } = req.body;

    let yeniDurum = "";

    // --- DURUM MANTIĞI ---
    if (islem === "Reddet") {
      yeniDurum = "Reddedildi";
    } else if (islem === "Direkt Onayla") {
      yeniDurum = "Onaylandı";
    } else if (islem === "Onayla") {
      if (onaylayan_rol.includes("Genel Müdür")) {
        yeniDurum = "Onaylandı";
      } else if (
        onaylayan_rol.includes("Departman Müdürü") ||
        onaylayan_rol.includes("Yönetici")
      ) {
        yeniDurum = "Genel Müdür Onayı Bekliyor";
      } else {
        yeniDurum = "Onaylandı"; // Fallback
      }
    }

    await pool.query("UPDATE izinler SET durum = $1 WHERE id = $2", [
      yeniDurum,
      id,
    ]);

    // Bildirim için talep edeni bul (Şemaya göre sütun: talep_eden)
    const izin = await pool.query("SELECT * FROM izinler WHERE id = $1", [id]);
    if (izin.rows.length > 0) {
      const { talep_eden } = izin.rows[0];

      let bildirimMesaji = "";
      if (yeniDurum === "Onaylandı")
        bildirimMesaji = `✅ İzin talebiniz ONAYLANDI.`;
      else if (yeniDurum === "Reddedildi")
        bildirimMesaji = `❌ İzin talebiniz REDDEDİLDİ.`;
      else if (yeniDurum === "Genel Müdür Onayı Bekliyor")
        bildirimMesaji = `👍 Yöneticiniz onayladı. Genel Müdür onayı bekleniyor.`;

      await pool.query(
        "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
        [bildirimMesajı, talep_eden]
      );
    }

    res.json({ message: "Durum güncellendi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// -----------------------------------------------------------
// İZİN BAKİYESİ VE GEÇMİŞİ (ŞEMAYA GÖRE DÜZELTİLDİ)
// GET /ik/izinler/kullanilan/:ad_soyad
// -----------------------------------------------------------
router.get("/izinler/kullanilan/:ad_soyad", async (req, res) => {
  try {
    const { ad_soyad } = req.params;

    // 1. Kullanılan İzin: Reddedilmemiş ve İptal Edilmemiş (Onaylı + Bekleyen) her şey
    const kullanilanSorgu = await pool.query(
      "SELECT SUM(gun_sayisi) as toplam FROM izinler WHERE talep_eden = $1 AND durum NOT IN ('Reddedildi', 'İptal Edildi')",
      [ad_soyad]
    );
    const kullanilan = parseInt(kullanilanSorgu.rows[0].toplam) || 0;

    // 2. Toplam Hak
    const hakSorgu = await pool.query(
      "SELECT toplam_izin_hakki FROM kullanicilar WHERE ad_soyad = $1",
      [ad_soyad]
    );
    const toplam_hak =
      hakSorgu.rows.length > 0 ? hakSorgu.rows[0].toplam_izin_hakki : 14;

    res.json({ kullanilan, toplam_hak });
  } catch (err) {
    console.error("İZİN HESAPLAMA HATASI:", err.message);
    res.status(500).send("Hata");
  }
});

module.exports = router;
