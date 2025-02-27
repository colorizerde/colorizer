const express = require("express");
const router = express.Router();
const ForumController = require("../controllers/ForumController");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const verifyToken = require("../middleware/verifyToken");

const uploadDir = path.resolve(__dirname, "../uploads/images");
const adUploadDir = path.resolve(__dirname, "../uploads/ads");

[uploadDir, adUploadDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 تم إنشاء المجلد: ${dir}`);
  }
});

const postStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const filename = Date.now() + "-" + file.originalname;
    console.log(`📷 رفع صورة المنشور: ${filename}`);
    cb(null, filename);
  },
});
const postUpload = multer({ storage: postStorage });

const adStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, adUploadDir),
  filename: (req, file, cb) => {
    const filename = Date.now() + "-" + file.originalname;
    console.log(`📷 رفع صورة الإعلان: ${filename}`);
    cb(null, filename);
  },
});
const adUpload = multer({ storage: adStorage });

router.get("/", ForumController.getAllPosts);
router.post("/post", verifyToken, postUpload.array("postImages", 4), ForumController.addPost);
router.get("/post/:postId/edit", verifyToken, ForumController.editPostForm);
router.post("/post/:postId/edit", verifyToken, postUpload.array("postImages", 4), ForumController.updatePost);
router.post("/post/:id/delete", verifyToken, ForumController.deletePost);
router.post("/toggle-like/:id", verifyToken, ForumController.toggleLike);
router.post("/post/:id/share", verifyToken, ForumController.sharePost);
router.post("/post/:id/hide", verifyToken, ForumController.hidePost);
router.post("/comments/:postId/add", verifyToken, ForumController.addComment);
router.get("/comments/:postId", ForumController.getComments);
router.post("/comments/:commentId/like", verifyToken, ForumController.toggleLikeComment);
router.get("/post/:postId", ForumController.getPostDetails);
router.post("/ad", verifyToken, adUpload.single("image"), ForumController.addAd);
router.get("/my-posts", verifyToken, ForumController.getUserPosts);

module.exports = router;