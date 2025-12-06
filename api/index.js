// api/index.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http"); // <-- EKLENDİ: Node.js HTTP Modülü
const { Server } = require("socket.io"); // <-- EKLENDİ: Socket.io
const pool = require("./config/db"); // <-- EKLENDİ: DB Bağlantısı (Mesaj kaydı için)
const { uploadDir } = require("./config/upload");
const mesaiRoutes = require("./routes/mesai");
const sureclerRoutes = require("./routes/surecler");

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
// SOCKET.IO MANTIĞI (GELİŞMİŞ - WHATSAPP LEVEL) ⚡
// ==========================================
io.on("connection", (socket) => {
  console.log(`⚡ Kullanıcı bağlandı: ${socket.id}`);

  // 1. Odaya Katıl
  socket.on("join_room", async (room) => {
    socket.join(room);
    console.log(`Kullanıcı ${socket.id} odaya katıldı: ${room}`);
  });

  // 2. Mesaj Gönderme
  socket.on("send_message", async (data) => {
    try {
      const yeniMesaj = await pool.query(
        "INSERT INTO mesajlar (sohbet_id, gonderen_id, icerik, mesaj_tipi, dosya_yolu, dosya_adi, tarih, okundu) VALUES ($1, $2, $3, $4, $5, $6, NOW(), FALSE) RETURNING *",
        [
          data.sohbet_id,
          data.gonderen_id,
          data.icerik,
          data.tip || "metin",
          data.dosya_yolu,
          data.dosya_adi,
        ]
      );

      // Sohbet listesini güncelle
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

      io.to(data.sohbet_id).emit("receive_message", yeniMesaj.rows[0]);
    } catch (err) {
      console.error("Mesaj hatası:", err);
    }
  });

  // 3. MESAJ DÜZENLEME (YENİ)
  socket.on("edit_message", async (data) => {
    try {
      // Veritabanını güncelle
      const result = await pool.query(
        "UPDATE mesajlar SET icerik = $1, duzenlendi = TRUE WHERE id = $2 RETURNING *",
        [data.yeniIcerik, data.mesajId]
      );
      // Odadaki herkese "Bu mesaj güncellendi" bilgisini at
      if (result.rows.length > 0) {
        io.to(result.rows[0].sohbet_id).emit("message_updated", result.rows[0]);
      }
    } catch (err) {
      console.error(err);
    }
  });

  // 4. MESAJ SİLME (Süre Kısıtlı - YENİ)
  socket.on("delete_message", async (data) => {
    try {
      // Önce mesajın tarihini kontrol et (Örn: 15 dakika kuralı)
      const mesajSorgu = await pool.query(
        "SELECT * FROM mesajlar WHERE id = $1",
        [data.mesajId]
      );
      if (mesajSorgu.rows.length === 0) return;

      const mesaj = mesajSorgu.rows[0];
      const farkDakika = (new Date() - new Date(mesaj.tarih)) / 1000 / 60;

      if (farkDakika > 15) {
        // Hata gönderebiliriz veya sessizce reddederiz. Şimdilik sessiz.
        return;
      }

      // Soft Delete: İçeriği sil, 'silindi' işaretle
      const result = await pool.query(
        "UPDATE mesajlar SET icerik = '🚫 Bu mesaj silindi', silindi = TRUE, dosya_yolu = NULL WHERE id = $1 RETURNING *",
        [data.mesajId]
      );

      if (result.rows.length > 0) {
        io.to(result.rows[0].sohbet_id).emit("message_updated", result.rows[0]);
      }
    } catch (err) {
      console.error(err);
    }
  });

  // 5. GÖRÜLDÜ İŞARETLEME (MAVİ TİK - YENİ)
  socket.on("mark_seen", async (data) => {
    // data: { sohbet_id, okuyan_id }
    try {
      // Bu sohbette, benden başkasının attığı ve okunmamış mesajları 'okundu' yap
      await pool.query(
        "UPDATE mesajlar SET okundu = TRUE WHERE sohbet_id = $1 AND gonderen_id != $2 AND okundu = FALSE",
        [data.sohbet_id, data.okuyan_id]
      );

      // Karşı tarafa "Senin mesajların okundu" sinyali gönder
      io.to(data.sohbet_id).emit("messages_seen_update", {
        sohbet_id: data.sohbet_id,
      });
    } catch (err) {
      console.error(err);
    }
  });

  // ... (Typing ve Disconnect aynı kalıyor) ...
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
app.use("/mesai", mesaiRoutes);
app.use("/surecler", sureclerRoutes);

// ==========================================
// SUNUCU BAŞLATMA (app.listen DEĞİL, server.listen)
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Socket.io Sunucusu çalışıyor: http://localhost:${PORT}`);
});
