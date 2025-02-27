const db = require("../config/db.js");

class ProfileModels {
  static async GetProfileModels(userId) {
    return new Promise((resolve, reject) => {
      const query =
        "SELECT id, name, avatar, age, gender, country, language, email, portfolio, occupation, phone, quote, likes, ranking, liked, DATE(created_at) as join_date FROM users WHERE id = ?";
      db.query(query, [userId], (error, results) => {
        if (error) return reject(error);
        resolve(results[0]);
      });
    });
  }
  
  static async UpdateProfileModels(userId, updatedData) {
    return new Promise((resolve, reject) => {
      const { name, avatar, age, gender, country, language, occupation, phone } = updatedData;
  
      const query =
        "UPDATE users SET name = ?, avatar = ?, age = ?, gender = ?, country = ?, language = ?, occupation = ?, phone = ? WHERE id = ?";
      db.query(
        query,
        [name, avatar, age, gender, country, language, occupation, phone, userId],
        (error, results) => {
          if (error) return reject(error);
          console.log("Update query results:", results);
          resolve(results);
        }
      );
    });
  }

  static async getAvatarById(userId) {
    return new Promise((resolve, reject) => {
      const query = "SELECT avatar FROM users WHERE id = ?";
      db.query(query, [userId], (error, results) => {
        if (error) return reject(error);
        resolve(results[0]);
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
              SET likes = GREATEST(likes - 1, 0), 
                  ranking = GREATEST(FLOOR((GREATEST(likes - 1, 0)) / 3), 0) 
              WHERE id = ?
            `;
            db.query(updateQuery, [friendId], (err, updateResult) => {
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
              SET likes = likes + 1, 
                  ranking = FLOOR((likes + 1) / 3) 
              WHERE id = ?
            `;
            db.query(updateQuery, [friendId], (err, updateResult) => {
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

  static async checkFriendStatus(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          CASE 
            WHEN (sender_id = ? AND receiver_id = ? AND status = 'pending') THEN 'pending'
            WHEN (sender_id = ? AND receiver_id = ? AND status = 'accepted') THEN 'accepted'
            WHEN (sender_id = ? AND receiver_id = ? AND status = 'pending') THEN 'pending'
            WHEN (sender_id = ? AND receiver_id = ? AND status = 'accepted') THEN 'accepted'
            ELSE 'no_friend'
          END AS status
        FROM friend_requests 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        LIMIT 1
      `;
      db.query(
        query,
        [userId, friendId, userId, friendId, friendId, userId, friendId, userId, userId, friendId, friendId, userId],
        (error, results) => {
          if (error) return reject(error);
          if (results.length === 0) return resolve("no_friend");
          resolve(results[0].status);
        }
      );
    });
  }

  static async sendFriendRequest(userId, friendId) {
    return new Promise((resolve, reject) => {
      const query = "INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, 'pending')";
      db.query(query, [userId, friendId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
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

  static async updateUserQuote(userId, quote) {
    return new Promise((resolve, reject) => {
      const query = "UPDATE users SET quote = ? WHERE id = ?";
      db.query(query, [quote, userId], (error, results) => {
        if (error) return reject(error);
        resolve(results.affectedRows > 0);
      });
    });
    
  }
  static async getGallery(userId) {
    return new Promise((resolve, reject) => {
      const query = "SELECT id, user_id, image, title, subtitle FROM design_gallery WHERE user_id = ? ORDER BY created_at DESC";
      db.query(query, [userId], (error, results) => {
        if (error) return reject(error);
        resolve(results);
      });
    });
  }

  static async addDesign(userId, image, title, subtitle) {
    return new Promise((resolve, reject) => {
      const query = "INSERT INTO design_gallery (user_id, image, title, subtitle) VALUES (?, ?, ?, ?)";
      db.query(query, [userId, image, title, subtitle], (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  static async deleteDesign(designId, userId) {
    return new Promise((resolve, reject) => {
      const query = "DELETE FROM design_gallery WHERE id = ? AND user_id = ?";
      db.query(query, [designId, userId], (error, result) => {
        if (error) return reject(error);
        resolve(result.affectedRows > 0);
      });
    });
  }
}

module.exports = ProfileModels;