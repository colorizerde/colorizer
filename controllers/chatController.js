const ChatModel = require("../models/ChatModel");
const NotificationModel = require("../models/NotificationModel");
const jwt = require("jsonwebtoken");
const { getIO } = require("../socket");

class ChatController {
  static async getChatPage(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const friendId = req.params.friendId;

      const messages = await ChatModel.getMessages(userId, friendId);
      const user = await ChatModel.getUserById(userId);
      const friend = await ChatModel.getUserById(friendId);

      if (!user || !friend) return res.status(404).send("المستخدم أو الصديق غير موجود");

      const currentUserAvatar = user.avatar ? (user.avatar.includes('/uploads/avatars/') ? user.avatar : `/uploads/avatars/${user.avatar}`) : '/uploads/images/pngwing.com.png';
      const friendAvatar = friend.avatar ? (friend.avatar.includes('/uploads/avatars/') ? friend.avatar : `/uploads/avatars/${friend.avatar}`) : '/uploads/images/pngwing.com.png';

      const enrichedMessages = messages.map((message) => ({
        ...message,
        sender_avatar: message.sender_id === userId 
          ? currentUserAvatar 
          : (message.sender_avatar ? (message.sender_avatar.includes('/uploads/avatars/') ? message.sender_avatar : `/uploads/avatars/${message.sender_avatar}`) : '/uploads/images/pngwing.com.png'),
      }));

      await ChatModel.updateLastActive(userId);

      const unreadCount = await NotificationModel.getUnreadCount(userId);
      const unreadMessagesCount = await ChatModel.getUnreadCount(userId);

      const io = getIO();
      io.emit("chatOpened", {
        userId,
        userName: user.name,
        userAvatar: currentUserAvatar,
        friendId,
        friendName: friend.name,
        friendAvatar,
      });

      res.render("chat", { 
        messages: enrichedMessages, 
        friendId, 
        userId,
        currentUserAvatar,
        friendAvatar,
        friendName: friend.name,
        friendLastActive: friend.last_active,
        unreadCount,
        unreadMessagesCount
      });
    } catch (error) {
      res.status(500).send("خطأ في تحميل صفحة الدردشة");
    }
  }

  static async sendMessage(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: "يرجى تسجيل الدخول أولاً" });

      const decoded = jwt.verify(token, "your_jwt_secret");
      const senderId = decoded.id;
      const { receiverId, messageContent } = req.body;
      const imagePath = req.file ? `/uploads/chatimage/${req.file.filename}` : null;

      if (!receiverId || (!messageContent?.trim() && !imagePath)) {
        return res.status(400).json({ error: "معرف المستلم أو المحتوى مطلوب" });
      }

      const isBlocked = await ChatModel.isUserBlocked(senderId, receiverId);
      if (isBlocked) {
        return res.status(403).json({ error: "لا يمكنك إرسال رسالة لأنك محظور" });
      }

      const message = await ChatModel.createMessage(senderId, receiverId, messageContent, imagePath);
      const sender = await ChatModel.getUserById(senderId);
      const senderAvatar = sender.avatar ? (sender.avatar.includes('/uploads/avatars/') ? sender.avatar : `/uploads/avatars/${sender.avatar}`) : '/uploads/images/pngwing.com.png';

      const io = getIO();
      io.emit("newMessage", {
        id: message.id,
        sender_id: senderId,
        receiver_id: receiverId,
        sender_name: sender.name,
        sender_avatar: senderAvatar,
        content: message.content,
        image_path: imagePath,
        created_at: message.created_at,
        is_read: 0
      });

      res.status(201).json({ message });
    } catch (error) {
      console.error("Error in sendMessage:", error);
      res.status(500).json({ error: "خطأ في إرسال الرسالة" });
    }
  }

  static async deleteMessage(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const messageId = req.params.messageId;

      const message = await ChatModel.getMessageById(messageId);
      if (!message || (message.sender_id !== userId && message.receiver_id !== userId)) {
        return res.status(403).send("غير مسموح لك بحذف هذه الرسالة");
      }

      await ChatModel.deleteMessage(messageId);
      res.redirect("/messages");
    } catch (error) {
      res.status(500).send("حدث خطأ أثناء حذف الرسالة");
    }
  }

  static async deleteAllMessages(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;

      await ChatModel.deleteAllMessages(userId);
      res.redirect("/messages");
    } catch (error) {
      res.status(500).send("خطأ أثناء حذف جميع الرسائل");
    }
  }

  static async getAllReceivedMessagesPage(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;

      const messages = await ChatModel.getReceivedMessages(userId);
      const currentUser = await ChatModel.getUserById(userId);
      const currentUserAvatar = currentUser?.avatar ? (currentUser.avatar.includes('/uploads/avatars/') ? currentUser.avatar : `/uploads/avatars/${currentUser.avatar}`) : '/uploads/images/pngwing.com.png';
      const friendId = messages.length > 0 
        ? messages[0].sender_id === userId ? messages[0].receiver_id : messages[0].sender_id 
        : null;

      const filteredMessages = messages.filter(message => message.sender_id !== userId);
      const latestMessages = filteredMessages.reduce((acc, message) => {
        acc[message.sender_id] = message;
        return acc;
      }, {});
      const enrichedMessages = Object.values(latestMessages).map(message => ({
        ...message,
        sender_avatar: message.sender_id === userId 
          ? currentUserAvatar 
          : (message.sender_avatar ? (message.sender_avatar.includes('/uploads/avatars/') ? message.sender_avatar : `/uploads/avatars/${message.sender_avatar}`) : '/uploads/images/pngwing.com.png'),
      }));

      const unreadCount = await NotificationModel.getUnreadCount(userId);
      const unreadMessagesCount = await ChatModel.getUnreadCount(userId);

      res.render("messages", {
        messages: enrichedMessages,
        userId,
        friendId,
        currentUserAvatar,
        unreadCount,
        unreadMessagesCount,
        errorMessage: null,
      });
    } catch (error) {
      res.render("messages", {
        messages: [],
        userId: null,
        friendId: null,
        currentUserAvatar: '/uploads/images/pngwing.com.png',
        unreadCount: 0,
        unreadMessagesCount: 0,
        errorMessage: "حدث خطأ أثناء جلب الرسائل",
      });
    }
  }

  static async getLatestMessagesPage(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;

      const currentUser = await ChatModel.getUserById(userId);
      const currentUserAvatar = currentUser?.avatar ? (currentUser.avatar.includes('/uploads/avatars/') ? currentUser.avatar : `/uploads/avatars/${currentUser.avatar}`) : '/uploads/images/pngwing.com.png';

      const messages = await ChatModel.getLatestMessagesForFriends(userId);
      const enrichedMessages = messages
        .filter(message => message.sender_id !== userId)
        .map(message => ({
          ...message,
          sender_avatar: message.sender_id === userId 
            ? currentUserAvatar 
            : (message.sender_avatar ? (message.sender_avatar.includes('/uploads/avatars/') ? message.sender_avatar : `/uploads/avatars/${message.sender_avatar}`) : '/uploads/images/pngwing.com.png'),
        }));

      const unreadCount = await NotificationModel.getUnreadCount(userId);
      const unreadMessagesCount = await ChatModel.getUnreadCount(userId);

      res.render("messages", {
        messages: enrichedMessages,
        userId,
        currentUserAvatar,
        unreadCount,
        unreadMessagesCount,
        errorMessage: null,
      });
    } catch (error) {
      res.render("messages", {
        messages: [],
        userId: null,
        currentUserAvatar: '/uploads/images/pngwing.com.png',
        unreadCount: 0,
        unreadMessagesCount: 0,
        errorMessage: "حدث خطأ أثناء جلب الرسائل",
      });
    }
  }

  static async showMessages(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;

      await ChatModel.markAllAsRead(userId);
      const messages = await ChatModel.getReceivedMessages(userId);
      const unreadCount = await NotificationModel.getUnreadCount(userId);
      const unreadMessagesCount = await ChatModel.getUnreadCount(userId);
      const currentUser = await ChatModel.getUserById(userId);
      const currentUserAvatar = currentUser?.avatar ? (currentUser.avatar.includes('/uploads/avatars/') ? currentUser.avatar : `/uploads/avatars/${currentUser.avatar}`) : '/uploads/images/pngwing.com.png';

      const filteredMessages = messages.filter(message => message.sender_id !== userId);
      const latestMessages = filteredMessages.reduce((acc, message) => {
        acc[message.sender_id] = message;
        return acc;
      }, {});
      const enrichedMessages = Object.values(latestMessages).map(message => ({
        ...message,
        sender_avatar: message.sender_id === userId 
          ? currentUserAvatar 
          : (message.sender_avatar ? (message.sender_avatar.includes('/uploads/avatars/') ? message.sender_avatar : `/uploads/avatars/${message.sender_avatar}`) : '/uploads/images/pngwing.com.png'),
      }));

      res.render("messages", { 
        messages: enrichedMessages, 
        unreadCount, 
        unreadMessagesCount,
        userId, 
        currentUserAvatar,
        errorMessage: null
      });
    } catch (error) {
      res.status(500).send("خطأ في عرض الرسائل");
    }
  }

  static async getMessagesPage(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;

      await ChatModel.markAllAsRead(userId);
      const messages = await ChatModel.getLatestMessagesForFriends(userId);
      const unreadCount = await NotificationModel.getUnreadCount(userId);
      const unreadMessagesCount = await ChatModel.getUnreadCount(userId);
      const currentUser = await ChatModel.getUserById(userId);
      const currentUserAvatar = currentUser?.avatar ? (currentUser.avatar.includes('/uploads/avatars/') ? currentUser.avatar : `/uploads/avatars/${currentUser.avatar}`) : '/uploads/images/pngwing.com.png';

      const enrichedMessages = messages
        .filter(message => message.sender_id !== userId)
        .map(message => ({
          ...message,
          sender_avatar: message.sender_id === userId 
            ? currentUserAvatar 
            : (message.sender_avatar ? (message.sender_avatar.includes('/uploads/avatars/') ? message.sender_avatar : `/uploads/avatars/${message.sender_avatar}`) : '/uploads/images/pngwing.com.png'),
        }));

      res.render("messages", {
        messages: enrichedMessages,
        userId,
        currentUserAvatar,
        unreadCount,
        unreadMessagesCount,
        errorMessage: null,
      });
    } catch (error) {
      res.render("messages", {
        messages: [],
        userId: null,
        currentUserAvatar: '/uploads/images/pngwing.com.png',
        unreadCount: 0,
        unreadMessagesCount: 0,
        errorMessage: "حدث خطأ أثناء جلب الرسائل",
      });
    }
  }

  static async markAllAsRead(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول أولاً" });

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;

      await ChatModel.markAllAsRead(userId);
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "خطأ أثناء تحديث حالة الرسائل" });
    }
  }

  static async markAsRead(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const messageId = req.params.id;

      const message = await ChatModel.getMessageById(messageId);
      if (!message || message.receiver_id !== userId) {
        return res.status(403).send("غير مسموح لك بتحديث هذه الرسالة");
      }

      await ChatModel.markAsRead(messageId);
      res.redirect("/messages");
    } catch (error) {
      res.status(500).send("خطأ أثناء تحديث حالة الرسالة");
    }
  }

  static async updateAvatar(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: "يرجى تسجيل الدخول أولاً" });

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const newAvatar = req.file ? req.file.filename : null;

      if (!newAvatar) return res.status(400).json({ error: "يجب تحميل صورة جديدة" });

      await ChatModel.updateUserAvatar(userId, newAvatar);
      const updatedUser = await ChatModel.getUserById(userId);
      const newAvatarPath = updatedUser.avatar ? (updatedUser.avatar.includes('/uploads/avatars/') ? updatedUser.avatar : `/uploads/avatars/${updatedUser.avatar}`) : '/uploads/images/pngwing.com.png';

      const io = getIO();
      io.emit("avatarUpdated", { 
        userId, 
        avatar: newAvatarPath 
      });

      res.json({ success: true, avatar: newAvatarPath });
    } catch (error) {
      res.status(500).json({ error: "خطأ أثناء تحديث الصورة" });
    }
  }

  static async getUnreadMessagesCount(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) {
        return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول أولاً" });
      }

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;

      const unreadMessagesCount = await ChatModel.getUnreadCount(userId);
      console.log(`Sending unreadMessagesCount for user ${userId}: ${unreadMessagesCount}`);
      res.json({ success: true, unreadMessagesCount });
    } catch (error) {
      console.error("Error in getUnreadMessagesCount:", error);
      res.status(500).json({ success: false, message: "خطأ أثناء جلب عدد الرسائل غير المقروءة" });
    }
  }
  
}

module.exports = ChatController;