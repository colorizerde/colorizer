const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const token = req.cookies.token || req.headers["authorization"];

  if (!token) {
    return res.status(401).send("غير مصرح لك بالوصول إلى هذه الصفحة");
  }

  try {
    const decoded = jwt.verify(token, "your_jwt_secret"); // استبدل "your_jwt_secret" بالمفتاح السري الخاص بك
    req.user = decoded; // تعيين `req.user` هنا
    next();
  } catch (error) {
    return res.status(403).send("رمز غير صالح أو منتهي الصلاحية");
  }
}

module.exports = verifyToken;