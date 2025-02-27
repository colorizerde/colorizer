const ProfileModels = require("../models/ProfileModels");
const NotificationModel = require("../models/NotificationModel");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

class ProfileControllers {
  static async addDesign(req, res) {
    try {
      if (!req.user || !req.user.id) return res.status(403).json({ success: false, message: "مطلوب تسجيل الدخول." });
      const userId = req.user.id;
      const { title, subtitle } = req.body;
      const image = req.file ? req.file.filename : null;
  
      if (!image || !title) return res.status(400).json({ success: false, message: "الصورة والعنوان مطلوبان." });
  
      const designId = await ProfileModels.addDesign(userId, image, title, subtitle);
      res.json({
        success: true,
        design: {
          id: designId,
          user_id: userId,
          image,
          title,
          subtitle
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "حدث خطأ في الخادم." });
    }
  }

  static async deleteDesign(req, res) {
    try {
      if (!req.user || !req.user.id) return res.status(403).json({ success: false, message: "مطلوب تسجيل الدخول." });
      const userId = req.user.id;
      const designId = req.params.designId;
  
      const deleted = await ProfileModels.deleteDesign(designId, userId);
      if (deleted) {
        res.json({
          success: true,
          designId: designId
        });
      } else {
        res.status(404).json({ success: false, message: "العمل غير موجود أو لا تملك صلاحية حذفه." });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "حدث خطأ في الخادم." });
    }
  }

  static async GetProfileControllers(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.redirect("/login");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const friendId = req.query.userId || userId;

      const user = await ProfileModels.GetProfileModels(friendId);
      if (!user) return res.status(404).send("المستخدم غير موجود");

      const currentUser = await ProfileModels.GetProfileModels(userId);
      const currentUserAvatar = currentUser && currentUser.avatar ? `/uploads/avatars/${currentUser.avatar}` : '/uploads/images/pngwing.com.png';

      const friendStatus = await ProfileModels.checkFriendStatus(userId, friendId);
      const unreadCount = await NotificationModel.getUnreadCount(userId);
      const hasLiked = await ProfileModels.hasUserLiked(userId, friendId);
      const gallery = await ProfileModels.getGallery(friendId);

      user.avatar = user.avatar ? (user.avatar.includes('/uploads/avatars/') ? user.avatar : `/uploads/avatars/${user.avatar}`) : '/uploads/images/pngwing.com.png';
      user.liked = hasLiked;

      res.render("profile", { 
        user, 
        friendStatus, 
        userId, 
        currentUserAvatar, 
        unreadCount,
        gallery
      });
    } catch (error) {
      res.status(500).send("حدث خطأ أثناء عرض الملف الشخصي.");
    }
  }

  static async GetUpdateProfileControllers(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.redirect("/login");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;

      const user = await ProfileModels.GetProfileModels(userId);
      if (!user) return res.status(404).send("User not found");

      const currentUserAvatar = user && user.avatar ? `/uploads/avatars/${user.avatar}` : '/uploads/images/pngwing.com.png';
      const unreadCount = await NotificationModel.getUnreadCount(userId);

      res.render("updateProfile", { 
        user, 
        currentUserAvatar, 
        unreadCount 
      });
    } catch (error) {
      res.status(500).send("حدث خطأ أثناء عرض صفحة تعديل الملف الشخصي.");
    }
  }

  static async UpdateProfileControllers(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.redirect("/login");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;

      const { name, age, gender, country, language, occupation, phone } = req.body;

      const currentUser = await ProfileModels.GetProfileModels(userId);
      if (!currentUser) return res.status(404).send("User not found");

      let avatar = currentUser.avatar;
      if (req.file) {
        avatar = req.file.filename;
        if (currentUser.avatar) {
          const oldAvatarPath = path.join(__dirname, "..", "uploads", "avatars", currentUser.avatar);
          if (fs.existsSync(oldAvatarPath)) fs.unlinkSync(oldAvatarPath);
        }
      }

      const updatedData = {
        name,
        age,
        gender,
        country,
        language,
        occupation,
        phone,
        avatar,
      };

      const result = await ProfileModels.UpdateProfileModels(userId, updatedData);

      if (result && result.affectedRows > 0) res.redirect("/profile");
      else res.status(400).send("فشل في تحديث الملف الشخصي");
    } catch (error) {
      res.status(500).send("حدث خطأ أثناء تحديث الملف الشخصي.");
    }
  }

  static async toggleLike(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("Unauthorized");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const friendId = req.body.userId;

      const result = await ProfileModels.toggleLike(userId, friendId);

      if (result.success) {
        return res.json({
          success: true,
          likes: result.likes,
          ranking: result.ranking,
          liked: result.liked,
        });
      } else {
        res.status(400).send(result.message || "حدث خطأ أثناء تحديث الإعجاب.");
      }
    } catch (error) {
      res.status(500).send("حدث خطأ في الخادم.");
    }
  }

  static async handleFriendAction(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("Unauthorized");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const { friendId, action } = req.body;

      if (action === "send_request") {
        const status = await ProfileModels.checkFriendRequestStatus(userId, friendId);
        if (status === "pending") {
          return res.json({ success: false, message: "طلب الصداقة قيد الانتظار بالفعل." });
        }
        const result = await ProfileModels.sendFriendRequest(userId, friendId);
        if (result) return res.json({ success: true, message: "تم إرسال طلب الصداقة بنجاح" });
      } else if (action === "cancel_request") {
        const result = await ProfileModels.cancelFriendRequest(userId, friendId);
        if (result) return res.json({ success: true, message: "تم إلغاء طلب الصداقة بنجاح" });
      }

      res.status(400).json({ success: false, message: "الإجراء غير صالح" });
    } catch (error) {
      res.status(500).send("حدث خطأ في الخادم.");
    }
  }

  static async updateQuote(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("Unauthorized");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const { quote } = req.body;

      const result = await ProfileModels.updateUserQuote(userId, quote);

      if (result) res.json({ success: true });
      else res.json({ success: false });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  }

  static async showProfile(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("Unauthorized");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;

      const user = await ProfileModels.GetProfileModels(userId);
      const currentUserAvatar = user && user.avatar ? `/uploads/avatars/${user.avatar}` : '/uploads/images/pngwing.com.png';
      const unreadCount = await NotificationModel.getUnreadCount(userId);

      user.avatar = user.avatar ? (user.avatar.includes('/uploads/avatars/') ? user.avatar : `/uploads/avatars/${user.avatar}`) : '/uploads/images/pngwing.com.png';

      res.render("profile", { 
        user, 
        userId, 
        currentUserAvatar, 
        unreadCount 
      });
    } catch (error) {
      res.status(500).send("Internal Server Error");
    }
  }
}

module.exports = ProfileControllers;