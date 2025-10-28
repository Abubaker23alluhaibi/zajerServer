const express = require('express');
const router = express.Router();
const { 
  getAllCustomers, 
  getCustomerById, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer,
  getCustomerStats,
  changePassword,
  updateCustomerArea,
  savePushToken
} = require('../controllers/customerController');
const { adminAuthMiddleware, authMiddleware } = require('../middleware/auth');

// Save customer push token
router.post('/push-token', authMiddleware, savePushToken);

// Update customer area (Customer can update their own area)
router.put('/my-area', authMiddleware, updateCustomerArea);

// Get all customers (Admin only)
router.get('/', adminAuthMiddleware, getAllCustomers);

// Get customer statistics (Admin only)
router.get('/stats', adminAuthMiddleware, getCustomerStats);

// Get customer by ID (Admin only)
router.get('/:id', adminAuthMiddleware, getCustomerById);

// Create new customer (Admin only)
router.post('/', adminAuthMiddleware, createCustomer);

// Update customer (Admin only)
router.put('/:id', adminAuthMiddleware, updateCustomer);

// Change customer password (Admin only)
router.put('/:id/password', adminAuthMiddleware, changePassword);

// Delete customer (Admin only)
router.delete('/:id', adminAuthMiddleware, deleteCustomer);

module.exports = router;

