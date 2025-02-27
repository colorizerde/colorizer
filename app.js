const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const multer = require("multer");
const session = require("express-session");
const http = require("http");
const { initSocket } = require("./socket");
const cron = require("node-cron");
const NotificationModel = require("./models/NotificationModel");
const forumRouter = require("./router/forumRoutes");
const userRouter = require("./router/UsersRouter");
const MessagesProjectRoutes = require("./router/messagesProjectRoutes");
const friendshipRoutes = require("./router/friendshipRoutes");
const notificationRouter = require("./router/notificationRoutes");
const chatRoutes = require("./router/chatRoutes");
const jobRoutes = require("./router/jobRoutes");
const profileRouter = require("./router/profileRouter");
const ProjectRoutes = require("./router/ProjectRoutes");
const contactRoutes = require("./router/contactRoutes");
const adminMessageRoutes = require("./router/adminMessageRoutes");
const adminDashboardRoutes = require("./router/adminDashboardRoutes");
const adminStatisticsRoutes = require("./router/adminStatisticsRoutes");
const adminSiteStatsRoutes = require("./router/adminSiteStatsRoutes");
const adminRolesPermissionsRoutes = require("./router/adminRolesPermissionsRoutes");
const adminForumSettingsRoutes = require("./router/adminForumSettingsRoutes");
const adminJobProjectSettingsRoutes = require("./router/adminJobProjectSettingsRoutes");
const GlobalRoleController = require("./controllers/GlobalRoleController");

const app = express();
const server = http.createServer(app);

// إعداد التخزين للملفات المرفوعة
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

const upload = multer({ storage: storage });

// إعدادات البرامج الوسيطة
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: "your_jwt_secret",
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// إعداد محرك العرض
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));

// Middleware لحساب unreadCount وتمريره إلى جميع الصفحات
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const unreadCount = await NotificationModel.getUnreadCount(req.session.userId);
      res.locals.unreadCount = unreadCount || 0;
    } catch (err) {
      console.error("حدث خطأ أثناء حساب unreadCount:", err);
    }
  } else {
    res.locals.unreadCount = 0;
  }
  next();
});

// تطبيق Middleware عالمي للتحقق من الدور
app.use(GlobalRoleController.setGlobalRole);

// دمج الراوترات
app.use("/", userRouter);
app.use(friendshipRoutes);
app.use(notificationRouter);
app.use("/forum", forumRouter);
app.use("/", chatRoutes);
app.use("/", jobRoutes);
app.use("/", profileRouter);
app.use("/projects", ProjectRoutes);
app.use("/", MessagesProjectRoutes);
app.use("/", contactRoutes);
app.use("/admin", adminMessageRoutes);
app.use("/admin", adminDashboardRoutes);
app.use("/admin", adminStatisticsRoutes);
app.use("/admin", adminSiteStatsRoutes);
app.use("/admin", adminRolesPermissionsRoutes);
app.use("/admin", adminForumSettingsRoutes);
app.use("/admin", adminJobProjectSettingsRoutes);
app.use("/", require("./router/GlobalRoleRouter")); // راوتر إضافي

// مسارات ثابتة للصفحات
app.get('/about', (req, res) =>
  res.render("about", { 
    unreadCount: res.locals.unreadCount,
    userId: res.locals.userId,
    isAdmin: res.locals.isAdmin 
  })
);
app.get('/privacy', (req, res) =>
  res.render("privacy", { 
    unreadCount: res.locals.unreadCount,
    userId: res.locals.userId,
    isAdmin: res.locals.isAdmin 
  })
);

// مسار مستقل لـ /ProjectSpace
app.get("/ProjectSpace", (req, res) => {
  res.render("ProjectSpace", {
    errorMessage: null,
    successMessage: null,
    userId: res.locals.userId,
    isAdmin: res.locals.isAdmin,
    unreadCount: res.locals.unreadCount,
  });
});

// إعداد Socket.IO
initSocket(server);

// جدولة حذف الإعلانات القديمة
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      await forumModel.deleteOldAds();
      console.log("Scheduled deletion of old ads completed.");
    } catch (err) {
      console.error("Error in scheduled deletion:", err);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Riyadh",
  }
);

// بدء الخادم للتشغيل المحلي فقط
const PORT = process.env.PORT || 8080;
if (process.env.VERCEL || process.env.NODE_ENV === "production") {
  // في بيئة Vercel أو الإنتاج، لا نقوم بنداء server.listen
  module.exports = app;
} else {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
