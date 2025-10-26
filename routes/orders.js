const express = require('express');
const router = express.Router();
const { 
  createOrder, 
  getCustomerOrders, 
  getOrderById, 
  updateOrderStatus, 
  getAllOrders,
  getOrderStats 
} = require('../controllers/orderController');
const { authMiddleware, adminAuthMiddleware } = require('../middleware/auth');

// Create new order (Customer only)
router.post('/', authMiddleware, createOrder);

// Get customer orders (Customer only)
router.get('/my-orders', authMiddleware, getCustomerOrders);

// Get order by ID (Customer only)
router.get('/:id', authMiddleware, getOrderById);

// Get all orders (Admin only)
router.get('/admin/all', adminAuthMiddleware, getAllOrders);

// Get order statistics (Admin only)
router.get('/admin/stats', adminAuthMiddleware, getOrderStats);

// Update order status (Admin only)
router.put('/:id/status', adminAuthMiddleware, updateOrderStatus);

module.exports = router;

