const express = require("express");
const router = express.Router();
const ProfileControllers = require("../controllers/ProfileControllers");
const multer = require("multer");
const path = require("path");
const verifyToken = require("../middleware/verifyToken");


// تكوين multer لتحميل الصور إلى مجلد "uploads/designs"
const designStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, "../uploads/designs"));
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + "-" + file.originalname;
    cb(null, filename);
  },
});

const designUpload = multer({ storage: designStorage });




// إعداد التخزين للملفات (الصور)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "..", "uploads", "avatars");
    console.log("Upload destination:", uploadPath); // للتحقق من المسار
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    console.log("Generated filename:", uniqueName); // للتحقق من اسم الملف
    cb(null, uniqueName);
  },
});

// تكوين multer مع تخزين الملفات
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("الصور فقط مسموح بها (jpeg/jpg/png)!"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // حد أقصى 5 ميجابايت
});

// مسار عرض صفحة الملف الشخصي (إزالة التعارض)
router.get("/profile", verifyToken, ProfileControllers.GetProfileControllers);

// مسار عرض صفحة تعديل الملف الشخصي
router.get("/updateProfile", verifyToken, ProfileControllers.GetUpdateProfileControllers);

// مسار تحديث الملف الشخصي (تغيير المسار ليتوافق مع النموذج)
router.post(
  "/updateProfile",
  verifyToken,
  upload.single("avatar"), // التعامل مع رفع الصورة
  ProfileControllers.UpdateProfileControllers
);

// مسار تبديل الإعجاب
router.post("/profile/like", verifyToken, ProfileControllers.toggleLike);

// مسار إدارة طلبات الصداقة
router.post("/friends/action", verifyToken, ProfileControllers.handleFriendAction);

// مسار تحديث الاقتباس
router.post("/profile/update-quote", verifyToken, ProfileControllers.updateQuote);



router.post("/profile/design/add", verifyToken, designUpload.single("image"), ProfileControllers.addDesign);
router.post("/profile/design/delete/:designId", verifyToken, ProfileControllers.deleteDesign);

// ... (بقية المسارات الأخرى)
module.exports = router;