require("dotenv").config();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const usersModels = require("../models/UsersModels");
const db = require("../config/db");

// إعدادات OAuth 2.0 مع بيانات الاعتماد من .env
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000/oauth2callback"
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

class UsersControllers {
  static findById(userId) {
    return new Promise((resolve, reject) => {
      db.query("SELECT * FROM users WHERE id = ?", [userId], (err, results) => {
        if (err) return reject(err);
        resolve(results[0]);
      });
    });
  }

  static async signUpControllers(req, res) {
    try {
      const { name, age, gender, country, language, occupation, phone, email, portfolio, password } = req.body;
      const avatar = req.file ? `/uploads/avatars/${req.file.filename}` : null;
      const hashedPassword = await bcrypt.hash(password, 10);

      const userId = await usersModels.createUser(
        name,
        avatar,
        age,
        gender,
        country,
        language,
        occupation,
        phone,
        email,
        portfolio,
        hashedPassword
      );

      const token = jwt.sign({ id: userId }, "your_jwt_secret", { expiresIn: "30d" });
      res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 60 * 60 * 1000 });
      res.redirect("/profile");
    } catch (error) {
      res.render("signup", {
        errorMessage: error.code === "ER_DUP_ENTRY" ? "البريد الإلكتروني مسجل بالفعل، الرجاء استخدام بريد آخر." : "حدث خطأ أثناء التسجيل، حاول مرة أخرى.",
      });
    }
  }

  static async loginControllers(req, res) {
    try {
      const { email, password } = req.body;
      const user = await usersModels.loginModel(email);

      if (!user) {
        return res.render("login", { errorMessage: "هذا البريد الإلكتروني غير مسجل، الرجاء التسجيل أولاً." });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.render("login", { errorMessage: "كلمة المرور أو البريد الإلكتروني غير صحيح، حاول مرة أخرى." });
      }

      const token = jwt.sign({ id: user.id }, "your_jwt_secret", { expiresIn: "30d" });
      res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 60 * 60 * 1000 });
      res.redirect("/profile");
    } catch (error) {
      res.render("login", { errorMessage: "حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى لاحقًا." });
    }
  }

  static async logoutControllers(req, res) {
    try {
      res.clearCookie("token");
      res.redirect("/login");
    } catch (error) {
      res.status(500).render("profile", { errorMessage: "حدث خطأ أثناء تسجيل الخروج، حاول مرة أخرى.", successMessage: null });
    }
  }

  static async forgotPasswordControllers(req, res) {
    const { email } = req.body;
  
    try {
      const user = await usersModels.loginModel(email);
      if (!user) {
        return res.render("forgotPassword", { errorMessage: "البريد الإلكتروني غير مسجل لدينا، تحقق منه مرة أخرى." });
      }
  
      const token = jwt.sign({ id: user.id }, "your_jwt_secret", { expiresIn: "15m" });
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      await usersModels.saveOTP(user.id, otp);
  
      const accessToken = await oAuth2Client.getAccessToken();
      if (!accessToken.token) throw new Error("فشل الحصول على Access Token");
  
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          type: "OAuth2",
          user: process.env.EMAIL_USER,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
          accessToken: accessToken.token,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
  
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "إعادة تعيين كلمة المرور",
        text: `رمز OTP الخاص بك هو: ${otp}. استخدم هذا الرابط للتحقق: http://localhost:3000/verify-otp?token=${token}`,
      };
  
      await transporter.sendMail(mailOptions);
  
      res.render("forgotPassword", {
        successMessage: "تم إرسال رابط التحقق مع رمز OTP إلى بريدك الإلكتروني.",
      });
    } catch (error) {
      res.render("forgotPassword", {
        errorMessage: "مشكلة في الاتصال، تحقق من الشبكة أو حاول مرة أخرى.",
      });
    }
  }

  static async verifyOTPControllers(req, res) {
    const { token, otp1, otp2, otp3, otp4 } = req.body;
    const otp = `${otp1}${otp2}${otp3}${otp4}`;

    try {
      const decoded = jwt.verify(token, "your_jwt_secret");
      const storedOTP = await usersModels.getOTP(decoded.id);

      if (!storedOTP || storedOTP !== otp) {
        return res.render("otpVerification", {
          errorMessage: "رمز OTP غير صحيح أو منتهي الصلاحية.",
          token,
          email: (await usersModels.loginModelById(decoded.id)).email,
        });
      }

      await usersModels.clearOTP(decoded.id);
      res.render("resetPassword", { token });
    } catch (error) {
      res.render("otpVerification", {
        errorMessage: error.name === "TokenExpiredError" ? "انتهت صلاحية الرمز، اطلب رمزًا جديدًا." : "الرابط أو الرمز غير صالح، حاول مرة أخرى.",
        token,
        email: "",
      });
    }
  }

  static async resendOTPControllers(req, res) {
    const { token } = req.body;

    try {
      const decoded = jwt.verify(token, "your_jwt_secret");
      const user = await usersModels.loginModelById(decoded.id);
      if (!user) throw new Error("المستخدم غير موجود");

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      await usersModels.saveOTP(decoded.id, otp);

      const accessToken = await oAuth2Client.getAccessToken();
      if (!accessToken.token) throw new Error("فشل الحصول على Access Token");

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          type: "OAuth2",
          user: process.env.EMAIL_USER,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
          accessToken: accessToken.token,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "إعادة إرسال رمز OTP",
        text: `رمز OTP الجديد الخاص بك هو: ${otp}. استخدم هذا الرابط للتحقق: http://localhost:3000/verify-otp?token=${token}`,
      };

      await transporter.sendMail(mailOptions);

      res.render("otpVerification", {
        successMessage: "تم إرسال رمز OTP جديد إلى بريدك الإلكتروني.",
        token,
        email: user.email,
      });
    } catch (error) {
      res.render("otpVerification", {
        errorMessage: error.message.includes("Invalid login")
          ? "فشلت المصادقة مع Gmail، تحقق من إعدادات الحساب أو الـ Refresh Token."
          : "حدث خطأ أثناء إعادة إرسال OTP، حاول مرة أخرى.",
        token,
        email: "",
      });
    }
  }

  static async resetPasswordControllers(req, res) {
    const { token, newPassword } = req.body;

    try {
      const decoded = jwt.verify(token, "your_jwt_secret");
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await usersModels.updatePassword(decoded.id, hashedPassword);

      res.render("login", {
        successMessage: "تم إعادة تعيين كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن.",
      });
    } catch (error) {
      res.render("resetPassword", {
        errorMessage: error.name === "TokenExpiredError" ? "انتهت صلاحية الرابط، اطلب رابطًا جديدًا." : "الرابط غير صالح أو منتهي الصلاحية، حاول مرة أخرى.",
        token,
      });
    }
  }

  static async updateProfileAjaxControllers(req, res) {
    try {
      const { name, age, gender, country, language, occupation, phone, portfolio } = req.body;
      const userId = req.user.id;

      await usersModels.updateUser(userId, name, null, age, gender, country, language, occupation, phone, portfolio);
      res.status(200).json({ message: "تم تحديث المعلومات بنجاح" });
    } catch (error) {
      res.status(500).json({ error: "حدث خطأ أثناء تحديث البيانات، حاول مرة أخرى." });
    }
  }
}

module.exports = UsersControllers;