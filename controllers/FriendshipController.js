const FriendshipModel = require("../models/FriendshipModel");
const ProfileModels = require("../models/ProfileModels");
const NotificationModel = require("../models/NotificationModel");
const jwt = require("jsonwebtoken");
const { getIO } = require("../socket");

class FriendshipController {
  static async showFriendsPage(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.redirect("/login");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;

      const friends = await FriendshipModel.getAcceptedFriends(userId, 0, 10);
      const friendRequests = await FriendshipModel.getFriendRequests(userId);
      const blockedFriends = await FriendshipModel.getBlockedFriends(userId);
      const allUsers = await FriendshipModel.getAllUsersExceptCurrent(userId, 0, 10);
      const unreadCount = await NotificationModel.getUnreadCount(userId);

      const enrichedFriends = friends.map(friend => ({
        ...friend,
        avatar: friend.avatar ? (friend.avatar.includes('/uploads/avatars/') ? friend.avatar : `/uploads/avatars/${friend.avatar}`) : '/uploads/images/pngwing.com.png',
        online: friend.last_active ? (Date.now() - new Date(friend.last_active).getTime() < 5 * 60 * 1000) : false,
        isActive: friend.is_active
      }));
      const enrichedFriendRequests = friendRequests.map(request => ({
        ...request,
        sender_avatar: request.sender_avatar ? (request.sender_avatar.includes('/uploads/avatars/') ? request.sender_avatar : `/uploads/avatars/${request.sender_avatar}`) : '/uploads/images/pngwing.com.png'
      }));
      const enrichedBlockedFriends = blockedFriends.map(blocked => ({
        ...blocked,
        avatar: blocked.avatar ? (blocked.avatar.includes('/uploads/avatars/') ? blocked.avatar : `/uploads/avatars/${blocked.avatar}`) : '/uploads/images/pngwing.com.png'
      }));
      const enrichedUsers = allUsers.map(user => ({
        ...user,
        avatar: user.avatar ? (user.avatar.includes('/uploads/avatars/') ? user.avatar : `/uploads/avatars/${user.avatar}`) : '/uploads/images/pngwing.com.png',
        isActive: user.is_active,
        country: user.country || 'غير محدد', // التأكد من وجود الدولة
        age: user.age || 'غير محدد',         // التأكد من وجود العمر
        language: user.language || 'غير محدد' // التأكد من وجود اللغة
      }));

      await FriendshipModel.updateLastActive(userId);

      res.render("friends", {
        friends: enrichedFriends,
        friendRequests: enrichedFriendRequests,
        blockedFriends: enrichedBlockedFriends,
        searchResults: null,
        users: enrichedUsers,
        unreadCount,
        errorMessage: null,
        successMessage: null
      });
    } catch (error) {
      res.status(500).render("friends", {
        friends: [],
        friendRequests: [],
        blockedFriends: [],
        searchResults: null,
        users: [],
        unreadCount: 0,
        errorMessage: "حدث خطأ أثناء تحميل بيانات الأصدقاء",
        successMessage: null
      });
    }
  }

  static async searchFriends(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.redirect("/login");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const searchQuery = req.query.q?.trim();

      if (!searchQuery) {
        return res.redirect("/friends"); // لا بحث فارغ
      }

      const searchResults = await FriendshipModel.searchUsers(userId, searchQuery);
      const friends = await FriendshipModel.getAcceptedFriends(userId, 0, 10);
      const friendRequests = await FriendshipModel.getFriendRequests(userId);
      const blockedFriends = await FriendshipModel.getBlockedFriends(userId);
      const unreadCount = await NotificationModel.getUnreadCount(userId);

      const enrichedFriends = friends.map(friend => ({
        ...friend,
        avatar: friend.avatar ? (friend.avatar.includes('/uploads/avatars/') ? friend.avatar : `/uploads/avatars/${friend.avatar}`) : '/uploads/images/pngwing.com.png',
        online: friend.last_active ? (Date.now() - new Date(friend.last_active).getTime() < 5 * 60 * 1000) : false,
        isActive: friend.is_active
      }));
      const enrichedFriendRequests = friendRequests.map(request => ({
        ...request,
        sender_avatar: request.sender_avatar ? (request.sender_avatar.includes('/uploads/avatars/') ? request.sender_avatar : `/uploads/avatars/${request.sender_avatar}`) : '/uploads/images/pngwing.com.png'
      }));
      const enrichedBlockedFriends = blockedFriends.map(blocked => ({
        ...blocked,
        avatar: blocked.avatar ? (blocked.avatar.includes('/uploads/avatars/') ? blocked.avatar : `/uploads/avatars/${blocked.avatar}`) : '/uploads/images/pngwing.com.png'
      }));
      const enrichedSearchResults = searchResults.map(result => ({
        ...result,
        avatar: result.avatar ? (result.avatar.includes('/uploads/avatars/') ? result.avatar : `/uploads/avatars/${result.avatar}`) : '/uploads/images/pngwing.com.png',
        isActive: result.is_active,
        country: result.country || 'غير محدد', // إضافة الدولة
        age: result.age || 'غير محدد',         // إضافة العمر
        language: result.language || 'غير محدد' // إضافة اللغة
      }));

      await FriendshipModel.updateLastActive(userId);

      res.render("friends", {
        friends: enrichedFriends,
        friendRequests: enrichedFriendRequests,
        blockedFriends: enrichedBlockedFriends,
        searchResults: enrichedSearchResults,
        users: [],
        unreadCount,
        errorMessage: searchResults.length === 0 ? "لم يتم العثور على نتائج مطابقة" : null,
        successMessage: null
      });
    } catch (error) {
      res.status(500).render("friends", {
        friends: [],
        friendRequests: [],
        blockedFriends: [],
        searchResults: [],
        users: [],
        unreadCount: 0,
        errorMessage: "حدث خطأ أثناء البحث عن الأصدقاء",
        successMessage: null
      });
    }
  }

  static async sendFriendRequest(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const friendId = req.body.friendId;

      if (!friendId) throw new Error("لم يتم تحديد المستخدم المطلوب");

      if (userId === friendId) {
        throw new Error("لا يمكنك إرسال طلب صداقة لنفسك");
      }

      const friendCount = await FriendshipModel.getFriendsCount(userId);
      if (friendCount >= 20) {
        throw new Error("لا يمكنك إضافة المزيد من الأصدقاء. لقد وصلت للحد الأقصى (20)");
      }

      const friendProfile = await FriendshipModel.getUserProfile(friendId);
      if (!friendProfile) {
        throw new Error("المستخدم المطلوب غير موجود");
      }
      if (!friendProfile.is_active) {
        throw new Error("لا يمكنك إرسال طلب صداقة لمستخدم غير نشط");
      }

      const isBlockedByMe = await FriendshipModel.isUserBlocked(userId, friendId);
      if (isBlockedByMe) {
        throw new Error("لا يمكنك إرسال طلب صداقة لمستخدم قمت بحظره. قم بإلغاء الحظر أولاً");
      }

      const isBlockedByFriend = await FriendshipModel.isUserBlocked(friendId, userId);
      if (isBlockedByFriend) {
        throw new Error("لا يمكنك إرسال طلب صداقة لأن هذا المستخدم قام بحظرك");
      }

      const existingRequest = await FriendshipModel.checkFriendRequestStatus(userId, friendId);
      if (existingRequest === "pending" && (await FriendshipModel.isSender(userId, friendId))) {
        throw new Error("لقد أرسلت طلب صداقة لهذا المستخدم بالفعل");
      }
      if (existingRequest === "pending" && !(await FriendshipModel.isSender(userId, friendId))) {
        throw new Error("هذا المستخدم أرسل لك طلب صداقة بالفعل. يمكنك قبوله بدلاً من ذلك");
      }

      const friendExists = await FriendshipModel.checkFriendship(userId, friendId);
      if (friendExists === "accepted") {
        throw new Error("هذا المستخدم صديقك بالفعل");
      }

      const lastRequestTime = await FriendshipModel.getLastRequestTime(userId, friendId);
      const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 ساعة
      if (lastRequestTime && (Date.now() - new Date(lastRequestTime).getTime()) < cooldownPeriod) {
        const timeLeft = Math.ceil((cooldownPeriod - (Date.now() - new Date(lastRequestTime).getTime())) / (60 * 60 * 1000));
        throw new Error(`لا يمكنك إعادة إرسال طلب صداقة الآن. انتظر ${timeLeft} ساعة منذ آخر طلب أو رفض`);
      }

      await FriendshipModel.sendFriendRequest(userId, friendId);

      const io = getIO();
      io.to(friendId).emit("friendRequestReceived", { 
        senderId: userId, 
        senderName: friendProfile.name || "مستخدم" 
      });

      const senderName = (await FriendshipModel.getUserProfile(userId)).name || "مستخدم";
      await NotificationModel.createNotification(
        friendId,
        userId,
        "friend_request",
        `${senderName} أرسل لك طلب صداقة. يمكنك قبوله أو رفضه من صفحة الأصدقاء`
      );

      res.redirect("/friends");
    } catch (error) {
      const userId = jwt.verify(req.cookies.token, "your_jwt_secret").id;
      const friends = await FriendshipModel.getAcceptedFriends(userId, 0, 10);
      const friendRequests = await FriendshipModel.getFriendRequests(userId);
      const blockedFriends = await FriendshipModel.getBlockedFriends(userId);
      const allUsers = await FriendshipModel.getAllUsersExceptCurrent(userId, 0, 10);
      const unreadCount = await NotificationModel.getUnreadCount(userId);

      res.status(400).render("friends", {
        friends: friends.map(f => ({
          ...f,
          avatar: f.avatar ? (f.avatar.includes('/uploads/avatars/') ? f.avatar : `/uploads/avatars/${f.avatar}`) : '/uploads/images/pngwing.com.png',
          online: f.last_active ? (Date.now() - new Date(f.last_active).getTime() < 5 * 60 * 1000) : false,
          isActive: f.is_active
        })),
        friendRequests: friendRequests.map(r => ({
          ...r,
          sender_avatar: r.sender_avatar ? (r.sender_avatar.includes('/uploads/avatars/') ? r.sender_avatar : `/uploads/avatars/${r.sender_avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        blockedFriends: blockedFriends.map(b => ({
          ...b,
          avatar: b.avatar ? (b.avatar.includes('/uploads/avatars/') ? b.avatar : `/uploads/avatars/${b.avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        searchResults: null,
        users: allUsers.map(u => ({
          ...u,
          avatar: u.avatar ? (u.avatar.includes('/uploads/avatars/') ? u.avatar : `/uploads/avatars/${u.avatar}`) : '/uploads/images/pngwing.com.png',
          isActive: u.is_active,
          country: u.country || 'غير محدد', // إضافة الدولة
          age: u.age || 'غير محدد',         // إضافة العمر
          language: u.language || 'غير محدد' // إضافة اللغة
        })),
        unreadCount,
        errorMessage: error.message || "حدث خطأ أثناء إرسال طلب الصداقة",
        successMessage: null
      });
    }
  }

  static async cancelFriendRequest(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const friendId = req.params.id;

      if (!friendId) throw new Error("لم يتم تحديد المستخدم المطلوب");

      const friendProfile = await FriendshipModel.getUserProfile(friendId);
      if (!friendProfile) {
        throw new Error("المستخدم المطلوب غير موجود");
      }

      const status = await FriendshipModel.checkFriendRequestStatus(userId, friendId);
      if (status !== "pending") {
        throw new Error("لا يوجد طلب صداقة معلق لإلغائه");
      }

      const isSender = await FriendshipModel.isSender(userId, friendId);
      if (!isSender) {
        throw new Error("لا يمكنك إلغاء هذا الطلب لأنك لست المرسل");
      }

      await FriendshipModel.cancelFriendRequest(userId, friendId);

      const io = getIO();
      io.to(friendId).emit("friendRequestCanceled", { senderId: userId });

      const senderName = (await FriendshipModel.getUserProfile(userId)).name || "مستخدم";
      const friendName = friendProfile.name || "مستخدم";
      await NotificationModel.createNotification(
        userId,
        friendId,
        "canceled",
        `قمت بإلغاء طلب الصداقة المرسل إلى ${friendName}`
      );
      await NotificationModel.createNotification(
        friendId,
        userId,
        "canceled_received",
        `${senderName} ألغى طلب الصداقة المرسل إليك`
      );

      res.redirect("/friends");
    } catch (error) {
      const userId = jwt.verify(req.cookies.token, "your_jwt_secret").id;
      const friends = await FriendshipModel.getAcceptedFriends(userId, 0, 10);
      const friendRequests = await FriendshipModel.getFriendRequests(userId);
      const blockedFriends = await FriendshipModel.getBlockedFriends(userId);
      const allUsers = await FriendshipModel.getAllUsersExceptCurrent(userId, 0, 10);
      const unreadCount = await NotificationModel.getUnreadCount(userId);

      res.status(400).render("friends", {
        friends: friends.map(f => ({
          ...f,
          avatar: f.avatar ? (f.avatar.includes('/uploads/avatars/') ? f.avatar : `/uploads/avatars/${f.avatar}`) : '/uploads/images/pngwing.com.png',
          online: f.last_active ? (Date.now() - new Date(f.last_active).getTime() < 5 * 60 * 1000) : false,
          isActive: f.is_active
        })),
        friendRequests: friendRequests.map(r => ({
          ...r,
          sender_avatar: r.sender_avatar ? (r.sender_avatar.includes('/uploads/avatars/') ? r.sender_avatar : `/uploads/avatars/${r.sender_avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        blockedFriends: blockedFriends.map(b => ({
          ...b,
          avatar: b.avatar ? (b.avatar.includes('/uploads/avatars/') ? b.avatar : `/uploads/avatars/${b.avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        searchResults: null,
        users: allUsers.map(u => ({
          ...u,
          avatar: u.avatar ? (u.avatar.includes('/uploads/avatars/') ? u.avatar : `/uploads/avatars/${u.avatar}`) : '/uploads/images/pngwing.com.png',
          isActive: u.is_active,
          country: u.country || 'غير محدد',
          age: u.age || 'غير محدد',
          language: u.language || 'غير محدد'
        })),
        unreadCount,
        errorMessage: error.message || "حدث خطأ أثناء إلغاء طلب الصداقة",
        successMessage: null
      });
    }
  }

  static async unblockFriend(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const friendId = req.params.id;

      if (!friendId) throw new Error("لم يتم تحديد المستخدم المطلوب");

      const friendProfile = await FriendshipModel.getUserProfile(friendId);
      if (!friendProfile) {
        throw new Error("المستخدم المطلوب غير موجود");
      }

      const isBlockedByMe = await FriendshipModel.isUserBlocked(userId, friendId);
      if (!isBlockedByMe) {
        throw new Error("هذا المستخدم ليس محظورًا لإلغاء حظره");
      }

      await FriendshipModel.unblockFriend(userId, friendId);

      const io = getIO();
      io.to(userId).emit("friendUnblocked", { friendId });
      io.to(friendId).emit("unblockedBy", { unblockerId: userId });

      const userName = (await FriendshipModel.getUserProfile(userId)).name || "مستخدم";
      const friendName = friendProfile.name || "مستخدم";
      await NotificationModel.createNotification(
        userId,
        friendId,
        "unblocked",
        `قمت بإلغاء حظر ${friendName}. يمكنك الآن إرسال طلب صداقة إذا أردت`
      );
      await NotificationModel.createNotification(
        friendId,
        userId,
        "unblocked_by",
        `${userName} قام بإلغاء حظرك. يمكنك الآن التفاعل معه`
      );

      res.redirect("/friends");
    } catch (error) {
      const userId = jwt.verify(req.cookies.token, "your_jwt_secret").id;
      const friends = await FriendshipModel.getAcceptedFriends(userId, 0, 10);
      const friendRequests = await FriendshipModel.getFriendRequests(userId);
      const blockedFriends = await FriendshipModel.getBlockedFriends(userId);
      const allUsers = await FriendshipModel.getAllUsersExceptCurrent(userId, 0, 10);
      const unreadCount = await NotificationModel.getUnreadCount(userId);

      res.status(400).render("friends", {
        friends: friends.map(f => ({
          ...f,
          avatar: f.avatar ? (f.avatar.includes('/uploads/avatars/') ? f.avatar : `/uploads/avatars/${f.avatar}`) : '/uploads/images/pngwing.com.png',
          online: f.last_active ? (Date.now() - new Date(f.last_active).getTime() < 5 * 60 * 1000) : false,
          isActive: f.is_active
        })),
        friendRequests: friendRequests.map(r => ({
          ...r,
          sender_avatar: r.sender_avatar ? (r.sender_avatar.includes('/uploads/avatars/') ? r.sender_avatar : `/uploads/avatars/${r.sender_avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        blockedFriends: blockedFriends.map(b => ({
          ...b,
          avatar: b.avatar ? (b.avatar.includes('/uploads/avatars/') ? b.avatar : `/uploads/avatars/${b.avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        searchResults: null,
        users: allUsers.map(u => ({
          ...u,
          avatar: u.avatar ? (u.avatar.includes('/uploads/avatars/') ? u.avatar : `/uploads/avatars/${u.avatar}`) : '/uploads/images/pngwing.com.png',
          isActive: u.is_active,
          country: u.country || 'غير محدد',
          age: u.age || 'غير محدد',
          language: u.language || 'غير محدد'
        })),
        unreadCount,
        errorMessage: error.message || "حدث خطأ أثناء إلغاء حظر الصديق",
        successMessage: null
      });
    }
  }

  static async acceptFriendRequest(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const requestId = req.params.id;

      const request = await FriendshipModel.getFriendRequestById(requestId);
      if (!request || request.receiver_id !== userId) {
        throw new Error("طلب الصداقة غير موجود أو ليس لك");
      }

      const senderProfile = await FriendshipModel.getUserProfile(request.sender_id);
      if (!senderProfile) {
        throw new Error("المرسل غير موجود");
      }
      if (!senderProfile.is_active) {
        throw new Error("لا يمكنك قبول طلب صداقة من مستخدم غير نشط");
      }

      const { senderId, receiverId } = await FriendshipModel.acceptFriendRequest(requestId, userId);

      const io = getIO();
      io.to(senderId).emit("friendRequestAccepted", { receiverId });

      const senderName = senderProfile.name || "مستخدم";
      const receiverName = (await FriendshipModel.getUserProfile(receiverId)).name || "مستخدم";

      await NotificationModel.createNotification(
        senderId,
        receiverId,
        "accepted",
        `${receiverName} قبل طلب صداقتك. يمكنك الآن التواصل معه`
      );
      await NotificationModel.createNotification(
        receiverId,
        senderId,
        "accepted",
        `أصبحت صديقًا مع ${senderName}. استمتع بالتواصل!`
      );

      res.redirect("/friends");
    } catch (error) {
      const userId = jwt.verify(req.cookies.token, "your_jwt_secret").id;
      const friends = await FriendshipModel.getAcceptedFriends(userId, 0, 10);
      const friendRequests = await FriendshipModel.getFriendRequests(userId);
      const blockedFriends = await FriendshipModel.getBlockedFriends(userId);
      const allUsers = await FriendshipModel.getAllUsersExceptCurrent(userId, 0, 10);
      const unreadCount = await NotificationModel.getUnreadCount(userId);

      res.status(400).render("friends", {
        friends: friends.map(f => ({
          ...f,
          avatar: f.avatar ? (f.avatar.includes('/uploads/avatars/') ? f.avatar : `/uploads/avatars/${f.avatar}`) : '/uploads/images/pngwing.com.png',
          online: f.last_active ? (Date.now() - new Date(f.last_active).getTime() < 5 * 60 * 1000) : false,
          isActive: f.is_active
        })),
        friendRequests: friendRequests.map(r => ({
          ...r,
          sender_avatar: r.sender_avatar ? (r.sender_avatar.includes('/uploads/avatars/') ? r.sender_avatar : `/uploads/avatars/${r.sender_avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        blockedFriends: blockedFriends.map(b => ({
          ...b,
          avatar: b.avatar ? (b.avatar.includes('/uploads/avatars/') ? b.avatar : `/uploads/avatars/${b.avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        searchResults: null,
        users: allUsers.map(u => ({
          ...u,
          avatar: u.avatar ? (u.avatar.includes('/uploads/avatars/') ? u.avatar : `/uploads/avatars/${u.avatar}`) : '/uploads/images/pngwing.com.png',
          isActive: u.is_active,
          country: u.country || 'غير محدد',
          age: u.age || 'غير محدد',
          language: u.language || 'غير محدد'
        })),
        unreadCount,
        errorMessage: error.message || "حدث خطأ أثناء قبول طلب الصداقة",
        successMessage: null
      });
    }
  }

  static async rejectFriendRequest(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const requestId = req.params.id;

      const request = await FriendshipModel.getFriendRequestById(requestId);
      if (!request || request.receiver_id !== userId) {
        throw new Error("طلب الصداقة غير موجود أو ليس لك");
      }

      const senderProfile = await FriendshipModel.getUserProfile(request.sender_id);
      if (!senderProfile) {
        throw new Error("المرسل غير موجود");
      }

      await FriendshipModel.rejectFriendRequest(requestId);

      const senderName = senderProfile.name || "مستخدم";
      const receiverName = (await FriendshipModel.getUserProfile(userId)).name || "مستخدم";

      await NotificationModel.createNotification(
        request.sender_id,
        userId,
        "rejected",
        `${receiverName} رفض طلب صداقتك`
      );
      await NotificationModel.createNotification(
        userId,
        request.sender_id,
        "rejected_by_me",
        `رفضت طلب الصداقة من ${senderName}`
      );

      const io = getIO();
      io.to(request.sender_id).emit("friendRequestRejected", { receiverId: userId });

      res.redirect("/friends");
    } catch (error) {
      const userId = jwt.verify(req.cookies.token, "your_jwt_secret").id;
      const friends = await FriendshipModel.getAcceptedFriends(userId, 0, 10);
      const friendRequests = await FriendshipModel.getFriendRequests(userId);
      const blockedFriends = await FriendshipModel.getBlockedFriends(userId);
      const allUsers = await FriendshipModel.getAllUsersExceptCurrent(userId, 0, 10);
      const unreadCount = await NotificationModel.getUnreadCount(userId);

      res.status(400).render("friends", {
        friends: friends.map(f => ({
          ...f,
          avatar: f.avatar ? (f.avatar.includes('/uploads/avatars/') ? f.avatar : `/uploads/avatars/${f.avatar}`) : '/uploads/images/pngwing.com.png',
          online: f.last_active ? (Date.now() - new Date(f.last_active).getTime() < 5 * 60 * 1000) : false,
          isActive: f.is_active
        })),
        friendRequests: friendRequests.map(r => ({
          ...r,
          sender_avatar: r.sender_avatar ? (r.sender_avatar.includes('/uploads/avatars/') ? r.sender_avatar : `/uploads/avatars/${r.sender_avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        blockedFriends: blockedFriends.map(b => ({
          ...b,
          avatar: b.avatar ? (b.avatar.includes('/uploads/avatars/') ? b.avatar : `/uploads/avatars/${b.avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        searchResults: null,
        users: allUsers.map(u => ({
          ...u,
          avatar: u.avatar ? (u.avatar.includes('/uploads/avatars/') ? u.avatar : `/uploads/avatars/${u.avatar}`) : '/uploads/images/pngwing.com.png',
          isActive: u.is_active,
          country: u.country || 'غير محدد',
          age: u.age || 'غير محدد',
          language: u.language || 'غير محدد'
        })),
        unreadCount,
        errorMessage: error.message || "حدث خطأ أثناء رفض طلب الصداقة",
        successMessage: null
      });
    }
  }

  static async blockFriend(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const friendId = req.params.id;

      if (!friendId) throw new Error("لم يتم تحديد المستخدم المطلوب");

      const friendProfile = await FriendshipModel.getUserProfile(friendId);
      if (!friendProfile) {
        throw new Error("المستخدم المطلوب غير موجود");
      }

      const isFriend = await FriendshipModel.checkFriendship(userId, friendId);
      if (isFriend !== "accepted") {
        throw new Error("هذا المستخدم ليس صديقك لحظره");
      }

      const existingRequest = await FriendshipModel.checkFriendRequestStatus(userId, friendId);
      if (existingRequest === "pending") {
        await FriendshipModel.cancelFriendRequest(userId, friendId); // إلغاء أي طلب معلق
      }

      await FriendshipModel.blockFriend(userId, friendId);

      const io = getIO();
      io.to(userId).emit("friendBlocked", { friendId });
      io.to(friendId).emit("friendBlockedBy", { blockerId: userId });

      const userName = (await FriendshipModel.getUserProfile(userId)).name || "مستخدم";
      const friendName = friendProfile.name || "مستخدم";
      await NotificationModel.createNotification(
        userId,
        friendId,
        "blocked",
        `قمت بحظر ${friendName}. لن يتمكن من التفاعل معك حتى تلغي الحظر`
      );
      await NotificationModel.createNotification(
        friendId,
        userId,
        "blocked_by",
        `${userName} قام بحظرك. لن تتمكن من التفاعل معه حتى يلغي الحظر`
      );

      res.redirect("/friends");
    } catch (error) {
      const userId = jwt.verify(req.cookies.token, "your_jwt_secret").id;
      const friends = await FriendshipModel.getAcceptedFriends(userId, 0, 10);
      const friendRequests = await FriendshipModel.getFriendRequests(userId);
      const blockedFriends = await FriendshipModel.getBlockedFriends(userId);
      const allUsers = await FriendshipModel.getAllUsersExceptCurrent(userId, 0, 10);
      const unreadCount = await NotificationModel.getUnreadCount(userId);

      res.status(400).render("friends", {
        friends: friends.map(f => ({
          ...f,
          avatar: f.avatar ? (f.avatar.includes('/uploads/avatars/') ? f.avatar : `/uploads/avatars/${f.avatar}`) : '/uploads/images/pngwing.com.png',
          online: f.last_active ? (Date.now() - new Date(f.last_active).getTime() < 5 * 60 * 1000) : false,
          isActive: f.is_active
        })),
        friendRequests: friendRequests.map(r => ({
          ...r,
          sender_avatar: r.sender_avatar ? (r.sender_avatar.includes('/uploads/avatars/') ? r.sender_avatar : `/uploads/avatars/${r.sender_avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        blockedFriends: blockedFriends.map(b => ({
          ...b,
          avatar: b.avatar ? (b.avatar.includes('/uploads/avatars/') ? b.avatar : `/uploads/avatars/${b.avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        searchResults: null,
        users: allUsers.map(u => ({
          ...u,
          avatar: u.avatar ? (u.avatar.includes('/uploads/avatars/') ? u.avatar : `/uploads/avatars/${u.avatar}`) : '/uploads/images/pngwing.com.png',
          isActive: u.is_active,
          country: u.country || 'غير محدد',
          age: u.age || 'غير محدد',
          language: u.language || 'غير محدد'
        })),
        unreadCount,
        errorMessage: error.message || "حدث خطأ أثناء حظر الصديق",
        successMessage: null
      });
    }
  }

  static async removeFriend(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const friendId = req.params.id;

      if (!friendId) throw new Error("لم يتم تحديد المستخدم المطلوب");

      const friendProfile = await FriendshipModel.getUserProfile(friendId);
      if (!friendProfile) {
        throw new Error("المستخدم المطلوب غير موجود");
      }

      const isFriend = await FriendshipModel.checkFriendship(userId, friendId);
      if (isFriend !== "accepted") {
        throw new Error("هذا المستخدم ليس صديقك لإزالته");
      }

      await FriendshipModel.removeFriend(userId, friendId);

      const io = getIO();
      io.to(friendId).emit("friendRemoved", { removerId: userId });

      const userName = (await FriendshipModel.getUserProfile(userId)).name || "مستخدم";
      const friendName = friendProfile.name || "مستخدم";
      await NotificationModel.createNotification(
        userId,
        friendId,
        "removed",
        `قمت بإزالة ${friendName} من قائمة أصدقائك`
      );
      await NotificationModel.createNotification(
        friendId,
        userId,
        "removed_by",
        `${userName} أزالك من قائمة أصدقائه`
      );

      res.redirect("/friends");
    } catch (error) {
      const userId = jwt.verify(req.cookies.token, "your_jwt_secret").id;
      const friends = await FriendshipModel.getAcceptedFriends(userId, 0, 10);
      const friendRequests = await FriendshipModel.getFriendRequests(userId);
      const blockedFriends = await FriendshipModel.getBlockedFriends(userId);
      const allUsers = await FriendshipModel.getAllUsersExceptCurrent(userId, 0, 10);
      const unreadCount = await NotificationModel.getUnreadCount(userId);

      res.status(400).render("friends", {
        friends: friends.map(f => ({
          ...f,
          avatar: f.avatar ? (f.avatar.includes('/uploads/avatars/') ? f.avatar : `/uploads/avatars/${f.avatar}`) : '/uploads/images/pngwing.com.png',
          online: f.last_active ? (Date.now() - new Date(f.last_active).getTime() < 5 * 60 * 1000) : false,
          isActive: f.is_active
        })),
        friendRequests: friendRequests.map(r => ({
          ...r,
          sender_avatar: r.sender_avatar ? (r.sender_avatar.includes('/uploads/avatars/') ? r.sender_avatar : `/uploads/avatars/${r.sender_avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        blockedFriends: blockedFriends.map(b => ({
          ...b,
          avatar: b.avatar ? (b.avatar.includes('/uploads/avatars/') ? b.avatar : `/uploads/avatars/${b.avatar}`) : '/uploads/images/pngwing.com.png'
        })),
        searchResults: null,
        users: allUsers.map(u => ({
          ...u,
          avatar: u.avatar ? (u.avatar.includes('/uploads/avatars/') ? u.avatar : `/uploads/avatars/${u.avatar}`) : '/uploads/images/pngwing.com.png',
          isActive: u.is_active,
          country: u.country || 'غير محدد',
          age: u.age || 'غير محدد',
          language: u.language || 'غير محدد'
        })),
        unreadCount,
        errorMessage: error.message || "حدث خطأ أثناء إزالة الصديق",
        successMessage: null
      });
    }
  }

  static async viewFriendProfileBySession(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).send("يرجى تسجيل الدخول أولاً");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const friendId = req.params.id;

      if (userId === friendId) {
        return res.redirect("/profile"); // لا يمكن عرض ملفك الشخصي عبر هذا المسار
      }

      const friendProfile = await FriendshipModel.getUserProfile(friendId);
      if (!friendProfile) {
        throw new Error("المستخدم غير موجود");
      }

      const isFriend = await FriendshipModel.checkFriendship(userId, friendId);
      const friendRequestStatus = await FriendshipModel.checkFriendRequestStatus(userId, friendId);
      const hasLiked = await FriendshipModel.hasUserLiked(userId, friendId);
      const gallery = await ProfileModels.getGallery(friendId);
      const isBlocked = await FriendshipModel.isUserBlocked(userId, friendId);

      const currentUser = await ProfileModels.GetProfileModels(userId);
      const currentUserAvatar = currentUser && currentUser.avatar ? `/uploads/avatars/${currentUser.avatar}` : '/uploads/images/pngwing.com.png';

      friendProfile.avatar = friendProfile.avatar ? (friendProfile.avatar.includes('/uploads/avatars/') ? friendProfile.avatar : `/uploads/avatars/${friendProfile.avatar}`) : '/uploads/images/pngwing.com.png';

      friendProfile = {
        ...friendProfile,
        name: friendProfile.name || 'غير محدد',
        country: friendProfile.country || 'غير محدد',
        age: friendProfile.age || 'غير محدد',
        gender: friendProfile.gender || 'غير محدد',
        language: friendProfile.language || 'غير محدد',
        occupation: friendProfile.occupation || 'غير محدد',
        email: friendProfile.email || 'غير محدد',
        portfolio: friendProfile.portfolio || '#',
        quote: friendProfile.quote || '',
        join_date: friendProfile.join_date || new Date(),
        likes: friendProfile.likes || 0,
        ranking: friendProfile.ranking || 0,
        share: friendProfile.share || 0,
        liked: hasLiked,
        id: friendProfile.id,
        isActive: friendProfile.is_active
      };

      let friendStatus = isFriend ? 'accepted' : friendRequestStatus === 'pending' ? 'pending' : isBlocked ? 'blocked' : 'no_friend';

      res.render("profile", { 
        user: friendProfile, 
        isFriend,
        userId,
        friendStatus,
        currentUserAvatar,
        unreadCount: await NotificationModel.getUnreadCount(userId),
        gallery,
        errorMessage: null,
        successMessage: null
      });
    } catch (error) {
      res.status(500).render("profile", {
        user: null,
        isFriend: false,
        userId: null,
        friendStatus: 'no_friend',
        currentUserAvatar: '/uploads/images/pngwing.com.png',
        unreadCount: 0,
        gallery: [],
        errorMessage: error.message || "حدث خطأ أثناء عرض الملف الشخصي للصديق",
        successMessage: null
      });
    }
  }

  static async viewFriendProfile(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.redirect("/login");

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const friendId = req.params.friendId;

      const friend = await ProfileModels.GetProfileModels(friendId);
      if (!friend) {
        throw new Error("الصديق غير موجود");
      }

      const friendStatus = await FriendshipModel.checkFriendRequestStatus(userId, friendId);
      const isFriend = await FriendshipModel.checkFriendship(userId, friendId);
      const gallery = await ProfileModels.getGallery(friendId);

      const currentUser = await ProfileModels.GetProfileModels(userId);
      const currentUserAvatar = currentUser && currentUser.avatar ? `/uploads/avatars/${currentUser.avatar}` : '/uploads/images/pngwing.com.png';

      friend.avatar = friend.avatar ? (friend.avatar.includes('/uploads/avatars/') ? friend.avatar : `/uploads/avatars/${friend.avatar}`) : '/uploads/images/pngwing.com.png';

      res.render("profile", { 
        user: friend, 
        friendStatus: isFriend ? 'accepted' : friendStatus,
        userId, 
        currentUserAvatar, 
        unreadCount: await NotificationModel.getUnreadCount(userId),
        gallery,
        errorMessage: null,
        successMessage: null
      });
    } catch (error) {
      res.status(500).render("profile", {
        user: null,
        friendStatus: 'no_friend',
        userId: null,
        currentUserAvatar: null,
        unreadCount: 0,
        gallery: [],
        errorMessage: error.message || "حدث خطأ أثناء عرض الملف الشخصي للصديق",
        successMessage: null
      });
    }
  }

  static async toggleLike(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ success: false, message: "غير مصرح" });

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const { friendId } = req.body;

      if (userId === friendId) {
        return res.status(400).json({ success: false, message: "لا يمكنك الإعجاب بنفسك" });
      }

      const friendProfile = await FriendshipModel.getUserProfile(friendId);
      if (!friendProfile || !friendProfile.is_active) {
        return res.status(400).json({ success: false, message: "المستخدم غير موجود أو غير نشط" });
      }

      const result = await FriendshipModel.toggleLike(userId, friendId);

      if (result.success) {
        const io = getIO();
        io.to(friendId).emit("likeUpdated", { likerId: userId, likes: result.likes, ranking: result.ranking });

        if (result.liked) {
          const likerName = (await FriendshipModel.getUserProfile(userId)).name || "مستخدم";
          await NotificationModel.createNotification(
            friendId,
            userId,
            "liked",
            `${likerName} أعجب بملفك الشخصي`
          );
        }

        res.json({ success: true, likes: result.likes, ranking: result.ranking, liked: result.liked });
      } else {
        res.json({ success: false, message: result.message });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || "حدث خطأ في الخادم" });
    }
  }

  static async handleFriendAction(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ success: false, message: "غير مصرح" });

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const { friendId, action } = req.body;

      if (!friendId) return res.status(400).json({ success: false, message: "لم يتم تحديد المستخدم" });

      if (userId === friendId) {
        return res.status(400).json({ success: false, message: "لا يمكنك تنفيذ هذا الإجراء على نفسك" });
      }

      const friendProfile = await FriendshipModel.getUserProfile(friendId);
      if (!friendProfile || !friendProfile.is_active) {
        return res.status(400).json({ success: false, message: "المستخدم غير موجود أو غير نشط" });
      }

      const io = getIO();
      const senderName = (await FriendshipModel.getUserProfile(userId)).name || "مستخدم";
      const friendName = friendProfile.name || "مستخدم";

      switch (action) {
        case "send_request":
          const friendCount = await FriendshipModel.getFriendsCount(userId);
          if (friendCount >= 20) {
            return res.json({ success: false, message: "لقد وصلت للحد الأقصى لعدد الأصدقاء (20)" });
          }

          const isBlockedByMe = await FriendshipModel.isUserBlocked(userId, friendId);
          if (isBlockedByMe) {
            return res.json({ success: false, message: "لا يمكنك إرسال طلب صداقة لمستخدم قمت بحظره" });
          }

          const isBlockedByFriend = await FriendshipModel.isUserBlocked(friendId, userId);
          if (isBlockedByFriend) {
            return res.json({ success: false, message: "لا يمكنك إرسال طلب صداقة لأن هذا المستخدم قام بحظرك" });
          }

          const status = await FriendshipModel.checkFriendRequestStatus(userId, friendId);
          if (status === "pending") {
            return res.json({ success: false, message: "طلب الصداقة قيد الانتظار بالفعل" });
          }

          const lastRequestTime = await FriendshipModel.getLastRequestTime(userId, friendId);
          const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 ساعة
          if (lastRequestTime && (Date.now() - new Date(lastRequestTime).getTime()) < cooldownPeriod) {
            return res.json({ success: false, message: "لا يمكنك إعادة إرسال طلب صداقة الآن. انتظر 24 ساعة" });
          }

          await FriendshipModel.sendFriendRequest(userId, friendId);
          io.to(friendId).emit("friendRequestReceived", { senderId: userId });
          await NotificationModel.createNotification(
            friendId,
            userId,
            "friend_request",
            `${senderName} أرسل لك طلب صداقة`
          );
          return res.json({ success: true, message: "تم إرسال طلب الصداقة بنجاح", friendStatus: "pending" });

        case "cancel_request":
          const cancelResult = await FriendshipModel.cancelFriendRequest(userId, friendId);
          if (cancelResult) {
            io.to(friendId).emit("friendRequestCanceled", { senderId: userId });
            await NotificationModel.createNotification(
              userId,
              friendId,
              "canceled",
              `قمت بإلغاء طلب الصداقة المرسل إلى ${friendName}`
            );
            await NotificationModel.createNotification(
              friendId,
              userId,
              "canceled_received",
              `${senderName} ألغى طلب الصداقة المرسل إليك`
            );
            return res.json({ success: true, message: "تم إلغاء طلب الصداقة بنجاح", friendStatus: "no_friend" });
          }
          return res.json({ success: false, message: "لا يوجد طلب صداقة لإلغائه" });

        default:
          return res.status(400).json({ success: false, message: "الإجراء غير صالح" });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || "حدث خطأ في الخادم" });
    }
  }

  static async getFriendRequest(req, res) {
    try {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ error: "يرجى تسجيل الدخول أولاً" });

      const decoded = jwt.verify(token, "your_jwt_secret");
      const userId = decoded.id;
      const senderId = req.params.senderId;

      const request = await FriendshipModel.getFriendRequestBySender(userId, senderId);
      if (!request) {
        return res.status(404).json({ error: "طلب الصداقة غير موجود" });
      }

      res.json({
        id: request.id,
        sender_name: request.sender_name,
        sender_avatar: request.sender_avatar ? (request.sender_avatar.includes('/uploads/avatars/') ? request.sender_avatar : `/uploads/avatars/${request.sender_avatar}`) : '/uploads/images/pngwing.com.png'
      });
    } catch (error) {
      res.status(500).json({ error: "خطأ أثناء جلب طلب الصداقة" });
    }
  }

  static async getFriend(req, res) {
    try {
      const friendId = req.params.friendId;
      const friend = await FriendshipModel.getUserProfile(friendId);
      if (!friend) {
        return res.status(404).json({ error: "الصديق غير موجود" });
      }

      res.json({
        id: friend.id,
        name: friend.name,
        avatar: friend.avatar ? (friend.avatar.includes('/uploads/avatars/') ? friend.avatar : `/uploads/avatars/${friend.avatar}`) : '/uploads/images/pngwing.com.png',
        online: friend.last_active ? (Date.now() - new Date(friend.last_active).getTime() < 5 * 60 * 1000) : false,
        isActive: friend.is_active
      });
    } catch (error) {
      res.status(500).json({ error: "خطأ أثناء جلب بيانات الصديق" });
    }
  }

  static async getBlockedFriend(req, res) {
    try {
      const friendId = req.params.friendId;
      const blocked = await FriendshipModel.getUserProfile(friendId);
      if (!blocked) {
        return res.status(404).json({ error: "المستخدم المحظور غير موجود" });
      }

      res.json({
        id: blocked.id,
        name: blocked.name,
        avatar: blocked.avatar ? (blocked.avatar.includes('/uploads/avatars/') ? blocked.avatar : `/uploads/avatars/${blocked.avatar}`) : '/uploads/images/pngwing.com.png'
      });
    } catch (error) {
      res.status(500).json({ error: "خطأ أثناء جلب بيانات الصديق المحظور" });
    }
  }
}

module.exports = FriendshipController;