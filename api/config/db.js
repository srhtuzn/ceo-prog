// api/config/db.js
const { Pool } = require("pg");
require("dotenv").config(); // .env dosyasını otomatik yükler

// ==========================================
// VERİTABANI BAĞLANTISI
// ==========================================

// .env dosyasındaki string değerleri kontrol ediyoruz
// (String 'true' gelirse boolean true yap, yoksa false)
const isSSL = process.env.DB_SSL === "true";

const pool = new Pool({
  user: process.env.DB_USER, // .env'den okur
  host: process.env.DB_HOST, // .env'den okur
  database: process.env.DB_NAME, // .env'den okur
  password: process.env.DB_PASS, // .env'den okur
  port: process.env.DB_PORT, // .env'den okur

  // SSL Ayarı: .env dosyasında DB_SSL=false ise kapalı olur.
  ssl: isSSL ? { rejectUnauthorized: false } : false,

  // Opsiyonel: Bağlantı zaman aşımı ayarları (Uzak sunucu için iyi olabilir)
  connectionTimeoutMillis: 5000, // 5 saniye bekle, bağlanamazsa hata ver
});

// Bağlantı testi (sunucu açılışında log)
pool
  .connect()
  .then((client) => {
    console.log(`✅ PostgreSQL bağlantısı başarılı: ${process.env.DB_HOST}`);
    client.release();
  })
  .catch((err) => {
    console.error("❌ PostgreSQL bağlantı hatası:", err.message);
    console.error(
      "İPUCU: pg_hba.conf dosyasında uzak bağlantıya izin verildiğinden ve güvenlik duvarının (5432) açık olduğundan emin olun."
    );
  });

module.exports = pool;
