// api/index.js
const express = require("express");
const cors = require("cors");
const path = require("path");
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
// ROUTE MODÜLLERİ
// ==========================================
const authRoutes = require("./routes/auth");
const ikRoutes = require("./routes/ik");
const gorevlerRoutes = require("./routes/gorevler");
const driveRoutes = require("./routes/drive");
const finansRoutes = require("./routes/finans");
const dashboardRoutes = require("./routes/dashboard");

// ==========================================
// ROUTE KAYITLARI
// ==========================================
app.use("/auth", authRoutes);
app.use("/ik", ikRoutes);
app.use("/gorevler", gorevlerRoutes);
app.use("/drive", driveRoutes);
app.use("/finans", finansRoutes);
app.use("/dashboard", dashboardRoutes);

// ==========================================
// SUNUCU BAŞLATMA
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Sunucu çalışıyor: http://localhost:${PORT}`);
});
