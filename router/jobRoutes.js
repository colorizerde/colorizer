const express = require("express");
const router = express.Router();
const JobController = require("../controllers/jobControllers");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const verifyToken = require("../middleware/verifyToken");

const uploadDir = path.resolve(__dirname, "../uploads/picjobs");
const cvDir = path.resolve(__dirname, "../uploads/cvs");

[uploadDir, cvDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 تم إنشاء المجلد: ${dir}`);
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const filename = Date.now() + path.extname(file.originalname);
    console.log(`📷 رفع صورة الوظيفة: ${filename}`);
    cb(null, filename);
  },
});
const upload = multer({ storage });

router.post("/jobs/add", verifyToken, upload.single("logo"), JobController.addJob);
router.post("/apply-job", verifyToken, JobController.applyJob);
router.get("/jobPage/all", JobController.getAllJobs);
router.get("/applications/:jobId", verifyToken, JobController.getApplications);
router.get("/jobs", (req, res) => res.render("jobs"));
router.get("/add-job", verifyToken, (req, res) => res.render("add-job"));
router.get("/listing-job", JobController.renderAllJobs);
router.get("/jobapplications", verifyToken, JobController.renderAllApplications);
router.get("/job/:jobId", verifyToken, JobController.renderJobDetail);

module.exports = router;