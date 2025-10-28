const express = require('express');
const router = express.Router();
const { getAdminConfig, updateAdminConfig, createAdmin, getAvailableDeliveryCount, updateAvailableDeliveryCount } = require('../controllers/configController');
const { adminAuthMiddleware } = require('../middleware/auth');

// Get admin config
router.get('/admin', adminAuthMiddleware, getAdminConfig);

// Create new admin
router.post('/admin', adminAuthMiddleware, createAdmin);

// Update admin config
router.put('/admin', adminAuthMiddleware, updateAdminConfig);

// Get available delivery count (public access for customers)
router.get('/available-delivery-count', getAvailableDeliveryCount);

// Update available delivery count (admin only)
router.put('/available-delivery-count', adminAuthMiddleware, updateAvailableDeliveryCount);

module.exports = router;

