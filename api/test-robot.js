const axios = require("axios");

// Sunucu Adresi
const API_URL = "http://localhost:3000";

// Test Kullanıcısı (Genel Müdür olmalı ki her yere erişebilsin)
const TEST_USER = {
  email: "ceo@sirket.com",
  sifre: "123456", // Veritabanındaki demo verideki şifre
};

// Renkli Konsol Çıktıları için Basit Fonksiyon
const log = (msg, type = "info") => {
  if (type === "success") console.log(`✅ BAŞARILI: ${msg}`);
  else if (type === "error") console.error(`❌ HATA: ${msg}`);
  else console.log(`ℹ️  ${msg}`);
};

async function runTests() {
  console.log("🤖 OTOMATİK SİSTEM TESTİ BAŞLIYOR...\n");

  let userToken = null;
  let userId = null;
  let userName = null;

  try {
    // -------------------------------------------------
    // 1. ADIM: AUTH MODÜLÜ TESTİ (Giriş Yapma)
    // -------------------------------------------------
    log("Auth Modülü test ediliyor...");
    const loginRes = await axios.post(`${API_URL}/auth/login`, TEST_USER);

    if (loginRes.status === 200 && loginRes.data.id) {
      userId = loginRes.data.id;
      userName = loginRes.data.ad_soyad;
      log(`Giriş yapıldı. Kullanıcı: ${userName} (ID: ${userId})`, "success");
    } else {
      throw new Error("Giriş yapılamadı!");
    }

    // -------------------------------------------------
    // 2. ADIM: İK MODÜLÜ TESTİ (Kullanıcı Listesi)
    // -------------------------------------------------
    log("\nİK Modülü test ediliyor...");
    const ikRes = await axios.get(`${API_URL}/ik/kullanicilar`);

    if (ikRes.status === 200 && Array.isArray(ikRes.data)) {
      log(
        `Kullanıcı listesi çekildi. Toplam Personel: ${ikRes.data.length}`,
        "success"
      );
    } else {
      log("Kullanıcı listesi çekilemedi.", "error");
    }

    // -------------------------------------------------
    // 3. ADIM: GÖREV MODÜLÜ TESTİ (Görev Ekleme)
    // -------------------------------------------------
    log("\nGörev Modülü test ediliyor...");
    const yeniGorev = {
      baslik: "Otomasyon Test Görevi " + Date.now(),
      aciklama: "Bu görev test robotu tarafından oluşturuldu.",
      oncelik: "Düşük",
      tarih: "2025-12-31",
      atananlar: JSON.stringify([userName]), // Kendine ata
      gozlemciler: JSON.stringify([]),
      proje_id: null,
      tekrar_tipi: "Tek Seferlik",
    };

    // Dosya yüklemesi olmadan JSON gönderimi (Backend'de upload.any() var ama dosya zorunlu değilse çalışır)
    // Not: Dosya yüklemesini simüle etmek için FormData gerekir ama basic test için JSON yeterli olabilir
    // Eğer backend 'dosya' bekliyorsa burası patlayabilir, kontrol edelim.
    // Backend kodumuzda req.file kontrolü "if(req.file)" şeklindeydi, yani zorunlu değil.

    // Axios JSON post
    const gorevRes = await axios.post(`${API_URL}/gorevler`, yeniGorev);

    if (gorevRes.status === 200 && gorevRes.data.id) {
      log(`Görev oluşturuldu. ID: ${gorevRes.data.id}`, "success");

      // Temizlik: Oluşturulan test görevini silelim
      await axios.delete(`${API_URL}/gorevler/${gorevRes.data.id}`);
      log("Test görevi temizlendi (Silindi).", "success");
    } else {
      log("Görev oluşturulamadı.", "error");
    }

    // -------------------------------------------------
    // 4. ADIM: FİNANS MODÜLÜ TESTİ (Listeleme)
    // -------------------------------------------------
    log("\nFinans Modülü test ediliyor...");
    // Query parametresi eklemeyi unutma (userId)
    const finansRes = await axios.get(`${API_URL}/finans?userId=${userId}`);

    if (finansRes.status === 200) {
      log(
        `Finans kayıtları çekildi. Kayıt Sayısı: ${finansRes.data.length}`,
        "success"
      );
    } else {
      log("Finans modülü yanıt vermedi.", "error");
    }

    // -------------------------------------------------
    // 5. ADIM: DRIVE MODÜLÜ TESTİ (İçerik Listeleme)
    // -------------------------------------------------
    log("\nDrive Modülü test ediliyor...");
    const driveRes = await axios.get(
      `${API_URL}/drive/icerik?userId=${userId}`
    );

    if (driveRes.status === 200) {
      log(`Drive erişimi başarılı.`, "success");
    } else {
      log("Drive modülü hatası.", "error");
    }

    console.log("\n---------------------------------------------------");
    console.log("🎉 TÜM TESTLER TAMAMLANDI! SİSTEM SAĞLIKLI GÖRÜNÜYOR.");
    console.log("---------------------------------------------------");
  } catch (error) {
    console.error("\n🚨 KRİTİK HATA OLUŞTU!");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Mesaj: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(error.message);
    }
  }
}

runTests();
