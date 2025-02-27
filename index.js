const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const multer = require("multer");
const session = require("express-session");

const app = express();

// إعداد التسجيل للأخطاء
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.url}`);
  next();
});

// إعداد التخزين للملفات المرفوعة (مع تعطيل الكتابة في Vercel)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "avatar") {
      cb(null, "uploads/avatars");
    } else if (file.fieldname === "postImages") {
      cb(null, "uploads/images");
    } else if (file.fieldname === "messageImage") {
      cb(null, "uploads/messages");
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = process.env.VERCEL ? multer() : multer({ storage: storage });

// إعدادات البرامج الوسيطة
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_jwt_secret",
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false }, // ضعها true في الإنتاج مع HTTPS
  })
);

// إعداد محرك العرض
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));

// مسار اختبار بسيط
app.get("/", (req, res) => {
  res.send("Hello from Vercel - Test Route");
});

// التقاط الأخطاء العامة
app.use((err, req, res, next) => {
  console.error("Error occurred:", err.stack);
  res.status(500).send("Something went wrong!");
});

// تصدير التطبيق لـ Vercel
module.exports = app;
