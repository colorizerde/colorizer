const express = require("express");
const multer = require("multer");
const NotificationController = require("../controllers/NotificationController");
const ChatController = require("../controllers/ChatController"); // لاستخدام markAllAsRead
const router = express.Router();

// إعداد multer لتحميل الصور
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/notifications");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// عرض صفحة الإشعارات
router.get("/notifications", NotificationController.showNotifications);

// تحديث حالة الإشعار إلى "تم العرض"
router.post("/notifications/:id/markAsViewed", NotificationController.markAsViewed);

// حذف إشعار معين
router.post("/notifications/delete/:id", NotificationController.deleteNotification);

// حذف جميع الإشعارات
router.post("/notifications/delete-all", NotificationController.deleteAllNotifications);

// عرض صفحة إرسال إشعار من المسؤول
router.get("/admin/notify", NotificationController.showAdminNotifyPage);

// إرسال إشعار من المسؤول
router.post("/admin/notifications", upload.single("image"), NotificationController.sendAdminNotification);

// تحديد جميع الإشعارات كمقروءة
router.post("/notifications/mark-all-as-read", NotificationController.markAllNotificationsAsRead);

// تحديد جميع الرسائل كمقروءة (من ChatController)
router.post("/chat/mark-all-as-read", ChatController.markAllAsRead);

module.exports = router;