const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Admin = require('../models/Admin');
const { adminAuthMiddleware } = require('../middleware/auth');
const PushNotificationService = require('../services/pushNotificationService');
const FirebaseMessagingService = require('../services/firebaseService');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const activeCustomers = await Customer.countDocuments({ status: 'active' });
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });

    // Get recent orders - optimized with lean()
    const recentOrders = await Order.find()
      .populate('customerId', 'storeName phoneNumber area')
      .select('orderNumber items totalAmount status customerId createdAt')
      .lean()
      .sort({ createdAt: -1 })
      .limit(5);

    // Get customers by area
    const customersByArea = await Customer.aggregate([
      {
        $group: {
          _id: '$area',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get orders by area
    const ordersByArea = await Order.aggregate([
      {
        $group: {
          _id: '$area',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalCustomers,
          activeCustomers,
          totalOrders,
          pendingOrders,
          deliveredOrders
        },
        recentOrders,
        customersByArea,
        ordersByArea
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب إحصائيات لوحة التحكم'
    });
  }
};

// Get system overview
const getSystemOverview = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const todayRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);

    const monthlyOrders = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(today.getFullYear(), today.getMonth(), 1)
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        todayOrders,
        todayRevenue: todayRevenue[0]?.total || 0,
        monthlyOrders
      }
    });
  } catch (error) {
    console.error('Get system overview error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب نظرة عامة على النظام'
    });
  }
};

// Get all orders for admin
const getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query; // Reduced from 100 to 20
    
    const filter = {};
    if (status) {
      filter.status = status;
    }
    
    // Optimize query with lean() and select specific fields
    const orders = await Order.find(filter)
      .populate('customerId', 'storeName phoneNumber area')
      .select('orderNumber items totalAmount deliveryFee deliveryAddress deliveryTime subArea subAreaPrice status area storeName customerId customerPhone clientPhone notes createdAt')
      .lean() // Convert to plain objects for better performance
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Order.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalOrders: total
        }
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب الطلبات'
    });
  }
};

// Register or update admin push token
router.post('/push-token', adminAuthMiddleware, async (req, res) => {
  try {
    const { pushToken } = req.body;
    
    if (!pushToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Push token is required'
      });
    }

    // Validate and normalize token format
    let trimmedToken = typeof pushToken === 'string' ? pushToken.trim() : String(pushToken).trim();
    
    if (trimmedToken.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Push token cannot be empty'
      });
    }

    // Handle tokens that might have a prefix before the actual token
    // Format: "prefix:actualToken" or just "actualToken"
    // For Android FCM tokens from Expo, the format is typically "projectNumber:actualToken"
    // We should take the part AFTER the colon as it's the actual FCM token
    let normalizedToken = trimmedToken;
    if (trimmedToken.includes(':')) {
      const parts = trimmedToken.split(':');
      if (parts.length >= 2) {
        // Take the part after the colon (typically the actual FCM token)
        // For Android: "projectNumber:FCM_TOKEN" -> use FCM_TOKEN
        normalizedToken = parts.slice(1).join(':'); // In case there are multiple colons
        console.log(`📝 Token normalized from ${trimmedToken.length} to ${normalizedToken.length} chars`);
        console.log(`📝 Original token preview: ${trimmedToken.substring(0, 50)}...`);
        console.log(`📝 Normalized token preview: ${normalizedToken.substring(0, 50)}...`);
      } else {
        // Fallback: take the longest part if split didn't work as expected
        normalizedToken = parts.reduce((longest, part) => 
          part.length > longest.length ? part : longest, ''
        );
        console.log(`⚠️ Token split unusual, using longest part: ${normalizedToken.length} chars`);
      }
    }

    // Check if token is valid (either Expo or FCM)
    const isExpoToken = PushNotificationService.isExpoToken(normalizedToken);
    const isValidFCM = FirebaseMessagingService.isValidFCMToken(normalizedToken);

    if (!isExpoToken && !isValidFCM) {
      console.log(`⚠️ Invalid push token format (length: ${normalizedToken.length}): ${normalizedToken.substring(0, 50)}...`);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid push token format. Token must be a valid Expo Push Token or FCM token.',
        details: {
          tokenLength: normalizedToken.length,
          tokenPreview: normalizedToken.substring(0, 30) + '...',
          isExpoToken: isExpoToken,
          isValidFCM: isValidFCM
        }
      });
    }

    // Update the specific admin account that is logged in
    // Use req.admin.adminId (MongoDB _id) or adminIdString from the middleware
    let admin = null;
    if (req.admin?.adminId) {
      // req.admin.adminId is MongoDB _id
      admin = await Admin.findById(req.admin.adminId);
    } else if (req.admin?.adminIdString) {
      // req.admin.adminIdString is the adminId field
      admin = await Admin.findOne({ adminId: req.admin.adminIdString, isActive: true });
    }
    
    // Fallback: if adminId not found, try to find any active admin
    const adminToUpdate = admin || await Admin.findOne({ isActive: true });
    
    if (!adminToUpdate) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }

    adminToUpdate.pushToken = normalizedToken;
    adminToUpdate.updatedAt = new Date();
    await adminToUpdate.save();

    const tokenType = isExpoToken ? 'Expo' : 'FCM';
    console.log(`✅ Admin push token registered (${tokenType}) for admin: ${adminToUpdate.adminId}, token: ${normalizedToken.substring(0, 30)}... (length: ${normalizedToken.length})`);

    res.status(200).json({
      status: 'success',
      message: 'تم تسجيل رمز الإشعارات بنجاح',
      data: {
        tokenType,
        tokenPreview: trimmedToken.substring(0, 30) + '...'
      }
    });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تسجيل رمز الإشعارات'
    });
  }
});

// Get unread notifications count for admin
router.get('/notifications/unread-count', adminAuthMiddleware, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const count = await Notification.countDocuments({ recipient: 'admin', isRead: false });
    
    res.status(200).json({
      status: 'success',
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب عدد الإشعارات غير المقروءة'
    });
  }
});

// Get admin dashboard
router.get('/dashboard', adminAuthMiddleware, getDashboardStats);

// Get system overview
router.get('/overview', adminAuthMiddleware, getSystemOverview);

// Get all orders
router.get('/orders', adminAuthMiddleware, getAllOrders);

module.exports = router;

