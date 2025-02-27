const mysql = require('mysql2');
const util = require('util');
require('dotenv').config(); // تحميل المتغيرات من .env

// إعداد الاتصال بقاعدة البيانات باستخدام المتغيرات البيئية
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT
});

db.connect((err) => {
  if (err) {
    console.error("❌ لم يتم الاتصال بقاعدة البيانات:", err);
    return;
  }
  console.log("✅ تم الاتصال بقاعدة البيانات بنجاح");
});

// تحويل db.query إلى Promise حتى يعمل مع async/await
db.query = util.promisify(db.query);

module.exports = db;
