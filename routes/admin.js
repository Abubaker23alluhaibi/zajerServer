const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { adminAuthMiddleware } = require('../middleware/auth');

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
      .select('orderNumber items totalAmount deliveryFee deliveryAddress deliveryTime subArea subAreaPrice status area customerId createdAt')
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

// Get admin dashboard
router.get('/dashboard', adminAuthMiddleware, getDashboardStats);

// Get system overview
router.get('/overview', adminAuthMiddleware, getSystemOverview);

// Get all orders
router.get('/orders', adminAuthMiddleware, getAllOrders);

module.exports = router;

