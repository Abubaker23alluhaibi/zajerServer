const express = require('express');
const router = express.Router();
const { customerLogin, adminLogin, getCustomerProfile, updateAdminSettings, getAdminSettings } = require('../controllers/authController');
const { authMiddleware, adminAuthMiddleware } = require('../middleware/auth');

// Customer login
router.post('/customer/login', customerLogin);

// Admin login
router.post('/admin/login', adminLogin);

// Get customer profile (protected)
router.get('/customer/profile', authMiddleware, getCustomerProfile);

// Get admin settings (protected)
router.get('/admin/settings', adminAuthMiddleware, getAdminSettings);

// Update admin settings (protected)
router.put('/admin/settings', adminAuthMiddleware, updateAdminSettings);

module.exports = router;

