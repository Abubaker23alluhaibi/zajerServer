const express = require('express');
const router = express.Router();
const { getAdminConfig, updateAdminConfig, createAdmin } = require('../controllers/configController');
const { adminAuthMiddleware } = require('../middleware/auth');

// Get admin config
router.get('/admin', adminAuthMiddleware, getAdminConfig);

// Create new admin
router.post('/admin', adminAuthMiddleware, createAdmin);

// Update admin config
router.put('/admin', adminAuthMiddleware, updateAdminConfig);

module.exports = router;

