const express = require('express');
const router = express.Router();
const { 
  getAllCustomers, 
  getCustomerById, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer,
  getCustomerStats 
} = require('../controllers/customerController');
const { adminAuthMiddleware } = require('../middleware/auth');

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

// Delete customer (Admin only)
router.delete('/:id', adminAuthMiddleware, deleteCustomer);

module.exports = router;

