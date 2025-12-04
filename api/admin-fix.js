const bcrypt = require("bcryptjs");
const pool = require("./config/db");

async function adminSifreDuzelt() {
  const email = "ceo@sirket.com";
  const yeniSifre = "123456";

  try {
    console.log("⏳ Şifre hashleniyor...");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(yeniSifre, salt);

    console.log("💾 Veritabanı güncelleniyor...");

    // 1. Kullanıcı var mı kontrol et
    const userCheck = await pool.query(
      "SELECT * FROM kullanicilar WHERE email = $1",
      [email]
    );

    if (userCheck.rows.length > 0) {
      // Varsa güncelle
      await pool.query("UPDATE kullanicilar SET sifre = $1 WHERE email = $2", [
        hashedPassword,
        email,
      ]);
      console.log(
        `✅ BAŞARILI: ${email} kullanıcısının şifresi '${yeniSifre}' olarak güncellendi.`
      );
    } else {
      // Yoksa oluştur (Acil Durum)
      await pool.query(
        "INSERT INTO kullanicilar (ad_soyad, email, sifre, departman, pozisyon, rol, hesap_durumu) VALUES ($1, $2, $3, 'Yönetim', 'CEO', 'Genel Müdür', 'Aktif')",
        ["Ahmet Yılmaz", email, hashedPassword]
      );
      console.log(`✅ BAŞARILI: ${email} kullanıcısı sıfırdan oluşturuldu.`);
    }

    process.exit();
  } catch (err) {
    console.error("❌ HATA:", err.message);
    process.exit(1);
  }
}

adminSifreDuzelt();
