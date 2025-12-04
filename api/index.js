// api/index.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http"); // <-- EKLENDİ: Node.js HTTP Modülü
const { Server } = require("socket.io"); // <-- EKLENDİ: Socket.io
const pool = require("./config/db"); // <-- EKLENDİ: DB Bağlantısı (Mesaj kaydı için)
const { uploadDir } = require("./config/upload");

const app = express();

// ==========================================
// MIDDLEWARE AYARLARI
// ==========================================
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Statik dosya servisi
app.use("/uploads", express.static(uploadDir));

// ==========================================
// SERVER KURULUMU (SOCKET.IO İÇİN)
// ==========================================
const server = http.createServer(app); // App'i server'a sardık

const io = new Server(server, {
  cors: {
    origin: "*", // Frontend adresi (Production'da spesifik domain verilmeli)
    methods: ["GET", "POST"],
  },
});

// ==========================================
// SOCKET.IO MANTIĞI (REAL-TIME CHAT) ⚡
// ==========================================
io.on("connection", (socket) => {
  console.log(`⚡ Kullanıcı bağlandı: ${socket.id}`);

  // 1. Odaya Katıl (Sohbet ID'sine göre)
  // Frontend: socket.emit("join_room", sohbet_id);
  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`Kullanıcı ${socket.id} odaya katıldı: ${room}`);
  });

  // 2. Mesaj Gönderme & Veritabanı Kaydı
  socket.on("send_message", async (data) => {
    // data: { sohbet_id, gonderen_id, icerik, tip, dosya_yolu ... }
    try {
      // A. Mesajı Veritabanına Kaydet
      const yeniMesaj = await pool.query(
        "INSERT INTO mesajlar (sohbet_id, gonderen_id, icerik, mesaj_tipi, dosya_yolu, dosya_adi) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [
          data.sohbet_id,
          data.gonderen_id,
          data.icerik,
          data.tip || "metin",
          data.dosya_yolu,
          data.dosya_adi,
        ]
      );

      // B. Sohbetin "Son Mesaj" bilgisini güncelle (Listede yukarı çıksın)
      const sonMesajMetni =
        data.tip === "dosya"
          ? "📎 Dosya"
          : data.tip === "resim"
          ? "📷 Resim"
          : data.icerik;
      await pool.query(
        "UPDATE sohbetler SET son_mesaj = $1, son_mesaj_tarihi = NOW() WHERE id = $2",
        [sonMesajMetni, data.sohbet_id]
      );

      // C. Mesajı Odadaki Herkese İlet (Gönderen dahil)
      // Frontend'de gönderen kişi mesajı iki kere görmesin diye kontrol eklenebilir
      // ama en garantisi veritabanından dönen ID'li mesajı basmaktır.
      io.to(data.sohbet_id).emit("receive_message", yeniMesaj.rows[0]);
    } catch (err) {
      console.error("Socket mesaj hatası:", err);
    }
  });

  // 3. Yazıyor... (Typing)
  socket.on("typing", (room) => socket.to(room).emit("display_typing"));
  socket.on("stop_typing", (room) => socket.to(room).emit("hide_typing"));

  socket.on("disconnect", () => {
    console.log("Kullanıcı ayrıldı:", socket.id);
  });
});

// ==========================================
// ROUTE MODÜLLERİ
// ==========================================
const authRoutes = require("./routes/auth");
const ikRoutes = require("./routes/ik");
const gorevlerRoutes = require("./routes/gorevler");
const driveRoutes = require("./routes/drive");
const finansRoutes = require("./routes/finans");
const dashboardRoutes = require("./routes/dashboard");
const chatRoutes = require("./routes/chat");

// ==========================================
// ROUTE KAYITLARI
// ==========================================
app.use("/auth", authRoutes);
app.use("/ik", ikRoutes);
app.use("/gorevler", gorevlerRoutes);
app.use("/drive", driveRoutes);
app.use("/finans", finansRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/chat", chatRoutes); // <-- HTTP işlemleri için (Grup kurma, geçmiş çekme vb.)

// ==========================================
// SUNUCU BAŞLATMA (app.listen DEĞİL, server.listen)
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Socket.io Sunucusu çalışıyor: http://localhost:${PORT}`);
});
