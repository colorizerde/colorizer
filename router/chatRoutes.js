const express = require("express");
const multer = require("multer");
const ChatController = require("../controllers/ChatController");

const router = express.Router();

// إعداد Multer لتخزين الصور في مجلد معين
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/chatimage/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// عرض صفحة الدردشة مع الصديق
router.get("/chat/:friendId", ChatController.getChatPage);

// إرسال رسالة جديدة (موحد مع الكود القديم)
router.post("/chat/sendMessage", upload.single("imagePath"), ChatController.sendMessage);

// حذف كل الرسائل
router.post("/messages/delete-all", ChatController.deleteAllMessages);

// حذف رسالة معينة
router.post("/messages/delete/:messageId", ChatController.deleteMessage);

// عرض صفحة الرسائل الواردة
router.get("/messages", ChatController.getMessagesPage);

// تحديث الصورة الرمزية
router.post("/updateAvatar", upload.single("avatar"), ChatController.updateAvatar);

// جلب عدد الرسائل غير المقروءة
router.get("/chat/unread-count", ChatController.getUnreadMessagesCount);

// تحديد جميع الرسائل كمقروءة
router.post("/chat/mark-all-as-read", ChatController.markAllAsRead);
module.exports = router;