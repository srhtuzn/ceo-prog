const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "78.186.33.234", // <-- Sunucunun Dış (Statik) IP'si
  database: "is_takip", // Veritabanı adı
  password: "Serhat@1510.", // Sunucudaki PostgreSQL şifresi
  port: 5432,
});

// Bağlantı testi (İsteğe bağlı, konsolda görmek için)
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Bağlantı Hatası:", err.message);
  } else {
    console.log("Sunucuya Bağlantı Başarılı! Saat:", res.rows[0].now);
  }
});

module.exports = pool;
