const db = require("../config/db");
const NotificationModel = require("./NotificationModel");

class FriendshipModel {
  static getAcceptedFriends(userId, offset = 0, limit = 10) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT u.*, u.last_active, u.is_active
        FROM users u
        WHERE u.id IN (SELECT friend_id FROM friendships WHERE user_id = ? AND status = 'accepted')
        ORDER BY u.last_active DESC
        LIMIT ?, ?
      `;
      db.query(query, [userId, offset, limit], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  static getFriendRequests(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT fr.id, u.name AS sender_name, u.avatar AS sender_avatar, fr.is_read, fr.created_at
        FROM friend_requests fr
        JOIN users u ON fr.sender_id = u.id 
        WHERE fr.receiver_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
      `;
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  static getBlockedFriends(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT u.* 
        FROM users u
        WHERE u.id IN (SELECT blocked_user_id FROM blocked_users WHERE user_id = ?)
        ORDER BY u.name ASC
      `;
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  static getAllUsersExceptCurrent(userId, offset = 0, limit = 10) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT u.id, u.name, u.avatar, u.last_active, u.is_active, u.country, u.age, u.language
        FROM users u
        WHERE u.id != ?
        AND u.id NOT IN (
          SELECT receiver_id FROM friend_requests WHERE sender_id = ? AND status = 'pending'
          UNION
          SELECT sender_id FROM friend_requests WHERE receiver_id = ? AND status = 'pending'
          UNION
          SELECT friend_id FROM friendships WHERE user_id = ? AND status = 'accepted'
          UNION
          SELECT blocked_user_id FROM blocked_users WHERE user_id = ?
        )
        ORDER BY u.name ASC
        LIMIT ?, ?
      `;
      db.query(query, [userId, userId, userId, userId, userId, offset, limit], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  static async sendFriendRequest(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO friend_requests (sender_id, receiver_id, status, is_read, created_at)
        VALUES (?, ?, 'pending', 0, NOW())
      `;
      db.query(query, [userId, friendId], (err, results) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            reject(new Error("لقد أرسلت طلب صداقة لهذا المستخدم بالفعل"));
          } else {
            reject(err);
          }
        } else {
          resolve(results);
        }
      });
    });
  }

  static async acceptFriendRequest(requestId, receiverId) {
    return new Promise((resolve, reject) => {
      const getRequestQuery = `
        SELECT sender_id, receiver_id FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = 'pending'
      `;
      db.query(getRequestQuery, [requestId, receiverId], async (err, results) => {
        if (err) return reject(err);
        if (results.length === 0) return reject(new Error("طلب الصداقة غير موجود أو ليس لك"));

        const { sender_id, receiver_id } = results[0];

        const senderFriendsCount = await this.getFriendsCount(sender_id);
        const receiverFriendsCount = await this.getFriendsCount(receiver_id);

        if (senderFriendsCount >= 20) {
          return reject(new Error("المرسل وصل للحد الأقصى لعدد الأصدقاء (20)"));
        }
        if (receiverFriendsCount >= 20) {
          return reject(new Error("لقد وصلت للحد الأقصى لعدد الأصدقاء (20)"));
        }

        const updateRequestQuery = `UPDATE friend_requests SET status = 'accepted', is_read = 1 WHERE id = ?`;
        db.query(updateRequestQuery, [requestId], (err) => {
          if (err) return reject(err);

          const insertFriendshipQuery = `
            INSERT INTO friendships (user_id, friend_id, status)
            VALUES (?, ?, 'accepted'), (?, ?, 'accepted')
            ON DUPLICATE KEY UPDATE status = 'accepted'
          `;
          db.query(insertFriendshipQuery, [sender_id, receiver_id, receiver_id, sender_id], async (err) => {
            if (err) return reject(err);
            resolve({ senderId: sender_id, receiverId: receiver_id });
          });
        });
      });
    });
  }

  static getFriendsCount(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) AS count FROM friendships WHERE user_id = ? AND status = 'accepted'
      `;
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0].count);
      });
    });
  }

  static rejectFriendRequest(requestId) {
    return new Promise((resolve, reject) => {
      const getRequestQuery = `
        SELECT sender_id, receiver_id FROM friend_requests WHERE id = ?
      `;
      db.query(getRequestQuery, [requestId], async (err, results) => {
        if (err) return reject(err);
        if (results.length === 0) return reject(new Error("طلب الصداقة غير موجود"));

        const { sender_id, receiver_id } = results[0];
        const updateRequestQuery = `UPDATE friend_requests SET status = 'rejected', is_read = 1 WHERE id = ?`;

        db.query(updateRequestQuery, [requestId], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  static blockFriend(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE user_id = user_id
      `;
      db.query(query, [userId, friendId], (err) => {
        if (err) return reject(err);

        const deleteFriendshipQuery = `
          DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
        `;
        db.query(deleteFriendshipQuery, [userId, friendId, friendId, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  static unblockFriend(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?
      `;
      db.query(query, [userId, friendId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  static removeFriend(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
      `;
      db.query(query, [userId, friendId, friendId, userId], (err, result) => {
        if (err) reject(err);
        else if (result.affectedRows === 0) reject(new Error("لا يوجد صداقة لإزالتها"));
        else resolve();
      });
    });
  }

  static getUserProfile(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT u.*, 
               (SELECT COUNT(*) FROM likes WHERE friend_id = u.id) AS likes,
               FLOOR((SELECT COUNT(*) FROM likes WHERE friend_id = u.id) / 3) AS ranking
        FROM users u 
        WHERE u.id = ?
      `;
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
  }

  static checkFriendship(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT status FROM friendships 
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
      `;
      db.query(query, [userId, friendId, friendId, userId], (err, results) => {
        if (err) reject(err);
        else resolve(results.length > 0 ? results[0].status : null);
      });
    });
  }

  static searchUsers(userId, searchQuery) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT u.id, u.name, u.avatar, u.is_active, u.country, u.age, u.language,
          CASE 
            WHEN f.status = 'accepted' THEN 'friend'
            WHEN fr.status = 'pending' AND fr.sender_id = ? THEN 'request_sent'
            WHEN fr.status = 'pending' AND fr.receiver_id = ? THEN 'request_received'
            WHEN bu.blocked_user_id IS NOT NULL THEN 'blocked'
            ELSE 'not_friend'
          END AS friendship_status
        FROM users u
        LEFT JOIN friendships f ON (f.user_id = u.id AND f.friend_id = ?) OR (f.user_id = ? AND f.friend_id = u.id)
        LEFT JOIN friend_requests fr ON (fr.sender_id = u.id AND fr.receiver_id = ?) OR (fr.receiver_id = u.id AND fr.sender_id = ?)
        LEFT JOIN blocked_users bu ON bu.user_id = ? AND bu.blocked_user_id = u.id
        WHERE u.id != ? AND (u.name LIKE ? OR u.email LIKE ?) AND u.is_active = 1
        ORDER BY u.name ASC
        LIMIT 10
      `;
      db.query(query, [userId, userId, userId, userId, userId, userId, userId, userId, `%${searchQuery}%`, `%${searchQuery}%`], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  static getUnreadFriendRequestsCount(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) AS unread_count 
        FROM friend_requests 
        WHERE receiver_id = ? AND status = 'pending' AND is_read = 0
      `;
      db.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0].unread_count || 0);
      });
    });
  }

  static updateLastActive(userId) {
    return new Promise((resolve, reject) => {
      const query = `UPDATE users SET last_active = NOW() WHERE id = ?`;
      db.query(query, [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  static getFriendRequestBySender(receiverId, senderId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT fr.id, u.name AS sender_name, u.avatar AS sender_avatar
        FROM friend_requests fr
        JOIN users u ON fr.sender_id = u.id
        WHERE fr.receiver_id = ? AND fr.sender_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
        LIMIT 1
      `;
      db.query(query, [receiverId, senderId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
  }

  static getFriendRequestById(requestId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT fr.id, fr.sender_id, fr.receiver_id
        FROM friend_requests fr
        WHERE fr.id = ?
      `;
      db.query(query, [requestId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
  }

  static async toggleLike(userId, friendId) {
    return new Promise((resolve, reject) => {
      const checkQuery = `SELECT * FROM likes WHERE user_id = ? AND friend_id = ?`;
      db.query(checkQuery, [userId, friendId], (err, results) => {
        if (err) return reject(err);

        const hasLiked = results.length > 0;

        if (hasLiked) {
          const deleteQuery = `DELETE FROM likes WHERE user_id = ? AND friend_id = ?`;
          db.query(deleteQuery, [userId, friendId], (err) => {
            if (err) return reject(err);

            const updateQuery = `
              UPDATE users 
              SET likes = (SELECT COUNT(*) FROM likes WHERE friend_id = ?),
                  ranking = FLOOR((SELECT COUNT(*) FROM likes WHERE friend_id = ?) / 3)
              WHERE id = ?
            `;
            db.query(updateQuery, [friendId, friendId, friendId], (err) => {
              if (err) return reject(err);

              db.query("SELECT likes, ranking FROM users WHERE id = ?", [friendId], (err, result) => {
                if (err) return reject(err);
                resolve({ success: true, likes: result[0].likes, ranking: result[0].ranking, liked: false });
              });
            });
          });
        } else {
          const insertQuery = `INSERT INTO likes (user_id, friend_id) VALUES (?, ?)`;
          db.query(insertQuery, [userId, friendId], (err) => {
            if (err) return reject(err);

            const updateQuery = `
              UPDATE users 
              SET likes = (SELECT COUNT(*) FROM likes WHERE friend_id = ?),
                  ranking = FLOOR((SELECT COUNT(*) FROM likes WHERE friend_id = ?) / 3)
              WHERE id = ?
            `;
            db.query(updateQuery, [friendId, friendId, friendId], (err) => {
              if (err) return reject(err);

              db.query("SELECT likes, ranking FROM users WHERE id = ?", [friendId], (err, result) => {
                if (err) return reject(err);
                resolve({ success: true, likes: result[0].likes, ranking: result[0].ranking, liked: true });
              });
            });
          });
        }
      });
    });
  }

  static async hasUserLiked(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT COUNT(*) AS count FROM likes WHERE user_id = ? AND friend_id = ?`;
      db.query(query, [userId, friendId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0].count > 0);
      });
    });
  }

  static async checkFriendRequestStatus(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT status, sender_id 
        FROM friend_requests 
        WHERE (sender_id = ? AND receiver_id = ?) OR (receiver_id = ? AND sender_id = ?)
        ORDER BY created_at DESC
        LIMIT 1
      `;
      db.query(query, [userId, friendId, userId, friendId], (err, results) => {
        if (err) reject(err);
        else if (results.length > 0) {
          resolve(results[0].status);
        } else {
          resolve('no_friend');
        }
      });
    });
  }

  static async isSender(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) AS count 
        FROM friend_requests 
        WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'
      `;
      db.query(query, [userId, friendId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0].count > 0);
      });
    });
  }

  static async cancelFriendRequest(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM friend_requests 
        WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'
      `;
      db.query(query, [userId, friendId], (err, results) => {
        if (err) reject(err);
        else resolve(results.affectedRows > 0);
      });
    });
  }

  static async isUserBlocked(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) AS count 
        FROM blocked_users 
        WHERE user_id = ? AND blocked_user_id = ?
      `;
      db.query(query, [userId, friendId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0].count > 0);
      });
    });
  }

  static async getLastRequestTime(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT created_at 
        FROM friend_requests 
        WHERE sender_id = ? AND receiver_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `;
      db.query(query, [userId, friendId], (err, results) => {
        if (err) reject(err);
        else resolve(results.length > 0 ? results[0].created_at : null);
      });
    });
  }
}

module.exports = FriendshipModel;