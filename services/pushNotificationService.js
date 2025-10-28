const fetch = require('node-fetch');

class PushNotificationService {
  /**
   * Send push notification to Expo
   */
  static async sendPushNotification(tokens, title, body, data = {}) {
    try {
      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        console.log('⚠️ No push tokens available');
        return;
      }

      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title: title,
        body: body,
        data: data,
        priority: 'high',
        channelId: 'default'
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages)
      });

      const result = await response.json();
      
      if (response.ok && result.data) {
        console.log('✅ Push notifications sent successfully:', result.data);
        return result.data;
      } else {
        console.error('❌ Failed to send push notifications:', result);
        return null;
      }
    } catch (error) {
      console.error('❌ Error sending push notifications:', error);
      return null;
    }
  }

  /**
   * Send immediate push notification to admin when new order arrives
   */
  static async notifyAdminNewOrder(orderData) {
    try {
      const Admin = require('../models/Admin');
      
      // Get all active admin push tokens
      const admins = await Admin.find({ 
        isActive: true,
        pushToken: { $ne: null }
      });

      if (admins.length === 0) {
        console.log('⚠️ No admin push tokens registered');
        return;
      }

      const tokens = admins.map(admin => admin.pushToken).filter(Boolean);
      
      if (tokens.length === 0) {
        console.log('⚠️ No valid push tokens found');
        return;
      }

      const title = '🔔 طلب جديد!';
      const body = `طلب جديد من ${orderData.storeName || 'عميل'}\nرقم الطلب: ${orderData.orderNumber}\nالمبلغ: ${orderData.totalAmount} دينار`;
      
      const notificationData = {
        type: 'new_order',
        orderId: orderData.orderId || orderData._id,
        orderNumber: orderData.orderNumber,
        storeName: orderData.storeName,
        totalAmount: orderData.totalAmount,
        area: orderData.area
      };

      console.log('📤 Sending push notification to admins...');
      const result = await this.sendPushNotification(tokens, title, body, notificationData);
      
      if (result) {
        console.log(`✅ Push notification sent successfully to ${tokens.length} admin(s)`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error in notifyAdminNewOrder:', error);
      return null;
    }
  }

  /**
   * Send push notification for order status update to customer
   */
  static async notifyCustomerOrderStatus(customerToken, status, orderData) {
    if (!customerToken) {
      console.log('⚠️ No customer token provided');
      return;
    }

    try {
      const statusMessages = {
        'confirmed': 'تم تأكيد طلبك',
        'preparing': 'جاري تحضير طلبك',
        'ready': 'طلبك جاهز للتوصيل',
        'delivered': 'تم توصيل طلبك بنجاح',
        'cancelled': 'تم إلغاء طلبك'
      };

      const title = '🔔 تحديث الطلب';
      const body = `${statusMessages[status] || 'تحديث حالة الطلب'}\nرقم الطلب: ${orderData.orderNumber}`;

      const notificationData = {
        type: 'order_status_update',
        orderId: orderData.orderId || orderData._id,
        orderNumber: orderData.orderNumber,
        status: status
      };

      console.log('📤 Sending push notification to customer...');
      const result = await this.sendPushNotification([customerToken], title, body, notificationData);
      
      if (result) {
        console.log('✅ Customer notification sent successfully');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error in notifyCustomerOrderStatus:', error);
      return null;
    }
  }
}

module.exports = PushNotificationService;

