// api/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  // 1. Token'ı header'dan al
  const token = req.header("Authorization");

  // 2. Token yoksa reddet
  if (!token) {
    return res.status(401).json({ msg: "Yetkisiz erişim! Token bulunamadı." });
  }

  try {
    // "Bearer <token>" formatını temizle
    const tokenString = token.startsWith("Bearer ")
      ? token.slice(7, token.length).trimLeft()
      : token;

    // 3. Token'ı doğrula
    // NOT: .env dosyana JWT_SECRET=cokGizliAnahtar eklemeyi unutma
    const decoded = jwt.verify(
      tokenString,
      process.env.JWT_SECRET || "gizliAnahtar"
    );

    // 4. Çözülen kullanıcı verisini isteğe ekle
    req.user = decoded.user;

    next(); // Sonraki işleme geç
  } catch (err) {
    res.status(401).json({ msg: "Token geçersiz veya süresi dolmuş." });
  }
};
