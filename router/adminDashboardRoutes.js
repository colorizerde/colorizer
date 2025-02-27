const express = require("express");
const AdminDashboardController = require("../controllers/AdminDashboardController");
const router = express.Router();

// عرض صفحة لوحة التحكم
router.get("/dashboard", AdminDashboardController.showDashboard);

module.exports = router;