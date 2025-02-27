const express = require("express");
const router = express.Router();
const UsersControllers = require("../controllers/usersControllers");
const multer = require("multer");
const upload = multer({ dest: "uploads/avatars/" });

// مسار تسجيل الحساب الجديد مع رفع الصورة
router.post("/signup", upload.single("avatar"), UsersControllers.signUpControllers);

// زر تعديل المعلومات الشخصية
router.post("/edit-profile", UsersControllers.updateProfileAjaxControllers);

// مسارات عرض الصفحات
router.get("/", (req, res) => res.render("login"));
router.get("/signup", (req, res) => res.render("signup"));
router.get("/login", (req, res) => res.render("login"));

// معالجة تسجيل الدخول
router.post("/login", UsersControllers.loginControllers);

// تسجيل الخروج
router.post("/logout", UsersControllers.logoutControllers);

// نسيت كلمة المرور
router.get("/forgotPassword", (req, res) => res.render("forgotPassword"));
router.post("/forgotPassword", UsersControllers.forgotPasswordControllers);

// التحقق عبر OTP
router.get("/verify-otp", (req, res) => {
  const { token } = req.query;
  res.render("otpVerification", { token, email: "" });
});
router.post("/verify-otp", UsersControllers.verifyOTPControllers);

// إعادة إرسال OTP
router.post("/resend-otp", UsersControllers.resendOTPControllers);

// إعادة تعيين كلمة المرور
router.get("/resetPassword", (req, res) => {
  const { token } = req.query;
  res.render("resetPassword", { token });
});
router.post("/resetPassword", UsersControllers.resetPasswordControllers);

module.exports = router;