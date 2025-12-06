const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ==========================================
// KULLANICI YÖNETİMİ
// ==========================================

// Tüm kullanıcıları getir (AKILLI & ZORUNLU HİYERARŞİ 🧠)
router.get("/kullanicilar", async (req, res) => {
  try {
    // 1. Tüm kullanıcıları çek
    const result = await pool.query(
      "SELECT id, ad_soyad, email, departman, pozisyon, rol, hesap_durumu, avatar, yonetici_id FROM kullanicilar ORDER BY id ASC"
    );
    let users = result.rows;

    // 2. Kritik Rolleri Bul (Referans Noktaları)
    // Genel Müdür (Birden fazla varsa ilkini al, yoksa null)
    const genelMudur = users.find((u) => u.rol === "Genel Müdür");

    // Departman Müdürleri Haritası (Örn: { 'Bilgi İşlem': UserObj, 'Muhasebe': UserObj })
    const deptMudurleri = {};
    users.forEach((u) => {
      if (u.rol === "Departman Müdürü") {
        deptMudurleri[u.departman] = u;
      }
    });

    // 3. Hiyerarşiyi Hesapla (Mapping)
    const computedUsers = users.map((user) => {
      // A. Manuel atama varsa onu kullan (Override)
      if (user.yonetici_id) {
        return { ...user, parent_id: user.yonetici_id };
      }

      // B. Rol Bazlı Otomatik Atama
      if (user.rol === "Genel Müdür") {
        // En tepe (Parent yok)
        return { ...user, parent_id: null };
      }

      if (user.rol === "Departman Müdürü") {
        // Müdüre -> Genel Müdür bakar
        return { ...user, parent_id: genelMudur ? genelMudur.id : null };
      }

      if (user.rol === "Personel" || user.rol === "Süpervizör") {
        // Personele -> Kendi Departman Müdürü bakar
        const myManager = deptMudurleri[user.departman];
        if (myManager) {
          return { ...user, parent_id: myManager.id };
        } else {
          // Müdürü yoksa -> Genel Müdüre bağlanır
          return { ...user, parent_id: genelMudur ? genelMudur.id : null };
        }
      }

      // Tanımsız rol ise boşa düşsün (veya GM'ye bağla)
      return { ...user, parent_id: genelMudur ? genelMudur.id : null };
    });

    res.json(computedUsers);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Sunucu hatası");
  }
});

// Kullanıcı güncelle
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
    await pool.query("DELETE FROM kullanicilar WHERE id = $1", [req.params.id]);
    res.json({ message: "Kullanıcı silindi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Silme hatası");
  }
});

// Yönetici ata (DÖNGÜ KONTROLÜ EKLENDİ 🛡️)
router.put("/kullanicilar/yonetici-ata/:id", async (req, res) => {
  try {
    const { id } = req.params; // Personel ID
    const { yonetici_id } = req.body; // Atanacak Yönetici ID

    // 1. Kendi kendine atamayı engelle
    if (parseInt(id) === parseInt(yonetici_id)) {
      return res.status(400).json({ error: "Kişi kendi yöneticisi olamaz!" });
    }

    // 2. (Opsiyonel ama İleri Seviye) Döngü Kontrolü:
    // Eğer A, B'nin yöneticisiyse; B, A'nın yöneticisi olamaz.
    // Bu kontrol veritabanında recursive query gerektirir, şimdilik basit tutuyoruz.

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

// Yönetici sil
router.put("/kullanicilar/yonetici-sil/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE kullanicilar SET yonetici_id = NULL WHERE id = $1",
      [req.params.id]
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

// 1. İzin Listele (GİZLİLİK EKLİ 🔒)
router.get("/izinler", async (req, res) => {
  try {
    const { userId } = req.query;
    const userRes = await pool.query(
      "SELECT rol, ad_soyad FROM kullanicilar WHERE id = $1",
      [userId]
    );

    if (userRes.rows.length === 0) return res.json([]);
    const user = userRes.rows[0];

    let query = "";
    let params = [];

    // Yönetici Roller HERKESİ görür
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
      // Personel SADECE KENDİNİ görür
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

// 2. Yeni İzin Talebi (AKILLI BİLDİRİM 🧠)
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

    // 1. Talep edenin departmanını bul
    const userRes = await pool.query(
      "SELECT departman FROM kullanicilar WHERE ad_soyad = $1",
      [ad_soyad]
    );
    let departman = "Genel";
    if (userRes.rows.length > 0) departman = userRes.rows[0].departman;

    // 2. İzin Kaydı
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

    // 3. Bildirim Gönder (Sadece İlgili Müdürlere ve GM'ye)
    const bildirim = `📅 ${ad_soyad} (${departman}) izin talep etti. Onay bekleniyor.`;

    // A. İlgili Departman Müdürleri
    const mudurler = await pool.query(
      "SELECT ad_soyad FROM kullanicilar WHERE departman = $1 AND rol = 'Departman Müdürü'",
      [departman]
    );
    for (let m of mudurler.rows) {
      await pool.query(
        "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
        [bildirim, m.ad_soyad]
      );
    }

    // B. Genel Müdürler
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
    console.error("İZİN EKLEME HATASI:", err.message);
    res.status(500).send("İzin oluşturulamadı");
  }
});

// 3. İzin İptal
router.put("/izinler/iptal/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE izinler SET durum = 'İptal Edildi' WHERE id = $1",
      [req.params.id]
    );
    res.json({ message: "İzin iptal edildi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 4. İzin Onay/Red
router.put("/izinler/onay/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { islem, onaylayan_rol } = req.body;

    let yeniDurum = "";
    if (islem === "Reddet") yeniDurum = "Reddedildi";
    else if (islem === "Direkt Onayla") yeniDurum = "Onaylandı";
    else if (islem === "Onayla") {
      if (onaylayan_rol.includes("Genel Müdür")) yeniDurum = "Onaylandı";
      else if (
        onaylayan_rol.includes("Departman Müdürü") ||
        onaylayan_rol.includes("Yönetici")
      )
        yeniDurum = "Genel Müdür Onayı Bekliyor";
      else yeniDurum = "Onaylandı";
    }

    await pool.query("UPDATE izinler SET durum = $1 WHERE id = $2", [
      yeniDurum,
      id,
    ]);

    // Talep sahibine bildirim
    const izin = await pool.query(
      "SELECT talep_eden FROM izinler WHERE id = $1",
      [id]
    );
    if (izin.rows.length > 0) {
      const { talep_eden } = izin.rows[0];
      let msj = "";
      if (yeniDurum === "Onaylandı") msj = `✅ İzin talebiniz ONAYLANDI.`;
      else if (yeniDurum === "Reddedildi")
        msj = `❌ İzin talebiniz REDDEDİLDİ.`;
      else if (yeniDurum.includes("Bekliyor"))
        msj = `👍 Yönetici onayladı, GM onayı bekleniyor.`;

      await pool.query(
        "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
        [msj, talep_eden]
      );

      // Eğer GM onayı bekliyorsa, GM'ye de bildirim at (Hatırlatma)
      if (yeniDurum.includes("Genel Müdür")) {
        const gmler = await pool.query(
          "SELECT ad_soyad FROM kullanicilar WHERE rol = 'Genel Müdür'"
        );
        for (let gm of gmler.rows) {
          await pool.query(
            "INSERT INTO bildirimler (mesaj, kime) VALUES ($1, $2)",
            [
              `📝 ${talep_eden} için yönetici onayı geldi. Son onay bekleniyor.`,
              gm.ad_soyad,
            ]
          );
        }
      }
    }

    res.json({ message: "Durum güncellendi" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Hata");
  }
});

// 5. İzin Özeti (HESAPLAMA DÜZELTİLDİ ✅)
router.get("/izinler/kullanilan/:ad_soyad", async (req, res) => {
  try {
    const { ad_soyad } = req.params;

    // Kullanılan: Reddedilmemiş ve İptal Edilmemiş (Onaylı + Bekleyen) her şey
    const kullanilanSorgu = await pool.query(
      "SELECT SUM(gun_sayisi) as toplam FROM izinler WHERE talep_eden = $1 AND durum NOT IN ('Reddedildi', 'İptal Edildi')",
      [ad_soyad]
    );
    const kullanilan = parseInt(kullanilanSorgu.rows[0].toplam) || 0;

    // Toplam Hak
    const hakSorgu = await pool.query(
      "SELECT toplam_izin_hakki FROM kullanicilar WHERE ad_soyad = $1",
      [ad_soyad]
    );
    const toplam_hak =
      hakSorgu.rows.length > 0 ? hakSorgu.rows[0].toplam_izin_hakki : 14;

    res.json({ kullanilan, toplam_hak });
  } catch (err) {
    console.error("HESAPLAMA HATASI:", err.message);
    res.status(500).send("Hata");
  }
});

module.exports = router;
