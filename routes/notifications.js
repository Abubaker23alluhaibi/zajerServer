const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notificationService');
const { authMiddleware, adminAuthMiddleware } = require('../middleware/auth');

// Get admin notifications
router.get('/admin', adminAuthMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await NotificationService.getAdminNotifications(page, limit);
    
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب الإشعارات'
    });
  }
});

// Get customer notifications
router.get('/customer', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await NotificationService.getCustomerNotifications(req.customer._id, page, limit);
    
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Get customer notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب الإشعارات'
    });
  }
});

// Get unread count for admin
router.get('/admin/unread-count', adminAuthMiddleware, async (req, res) => {
  try {
    const count = await NotificationService.getUnreadCount('admin');
    
    res.status(200).json({
      status: 'success',
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Get admin unread count error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب عدد الإشعارات غير المقروءة'
    });
  }
});

// Get unread count for customer
router.get('/customer/unread-count', authMiddleware, async (req, res) => {
  try {
    const count = await NotificationService.getUnreadCount('customer', req.customer._id);
    
    res.status(200).json({
      status: 'success',
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Get customer unread count error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب عدد الإشعارات غير المقروءة'
    });
  }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await NotificationService.markAsRead(req.params.id);
    
    res.status(200).json({
      status: 'success',
      message: 'تم تحديد الإشعار كمقروء',
      data: { notification }
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تحديد الإشعار كمقروء'
    });
  }
});

// Mark all notifications as read for admin
router.put('/admin/mark-all-read', adminAuthMiddleware, async (req, res) => {
  try {
    const result = await NotificationService.markAllAsRead('admin');
    
    res.status(200).json({
      status: 'success',
      message: 'تم تحديد جميع الإشعارات كمقروءة',
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Mark all admin notifications as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تحديد جميع الإشعارات كمقروءة'
    });
  }
});

// Mark all notifications as read for customer
router.put('/customer/mark-all-read', authMiddleware, async (req, res) => {
  try {
    const result = await NotificationService.markAllAsRead('customer', req.customer._id);
    
    res.status(200).json({
      status: 'success',
      message: 'تم تحديد جميع الإشعارات كمقروءة',
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Mark all customer notifications as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تحديد جميع الإشعارات كمقروءة'
    });
  }
});

module.exports = router;

