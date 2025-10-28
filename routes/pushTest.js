const express = require('express');
const router = express.Router();
const PushNotificationService = require('../services/pushNotificationService');

// Route to send test push notification
router.post('/test', async (req, res) => {
  const { recipient, customerId, title, message, data } = req.body;
  
  try {
    let expoPushToken = null;
    
    console.log('📤 Test push notification requested:', {
      recipient,
      customerId,
      title,
      message
    });
    
    // Get push token based on recipient
    if (recipient === 'customer' && customerId) {
      const Customer = require('../models/Customer');
      const customer = await Customer.findById(customerId);
      
      if (customer?.expoPushToken) {
        expoPushToken = customer.expoPushToken;
        console.log('✅ Found customer token');
      } else {
        console.log('⚠️ Customer has no push token');
      }
    }
    
    if (recipient === 'admin') {
      const Admin = require('../models/Admin');
      const admin = await Admin.findOne({ 
        isActive: true, 
        pushToken: { $ne: null } 
      });
      
      if (admin?.pushToken) {
        expoPushToken = admin.pushToken;
        console.log('✅ Found admin token');
      } else {
        console.log('⚠️ Admin has no push token');
      }
    }
    
    if (!expoPushToken) {
      return res.status(404).json({
        status: 'error',
        message: 'No push token found for this recipient'
      });
    }
    
    // Send push notification
    const result = await PushNotificationService.sendPushNotification(
      [expoPushToken],
      title || 'إشعار تجريبي',
      message || 'هذا إشعار تجريبي',
      data || {}
    );
    
    if (result) {
      console.log('✅ Push notification sent successfully');
      res.json({
        status: 'success',
        message: 'Notification sent successfully',
        data: result
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to send notification'
      });
    }
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;

