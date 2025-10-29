const fetch = require('node-fetch');

class PushNotificationService {
  /**
   * Check if token is Expo Push Token or FCM token
   */
  static isExpoToken(token) {
    return token && typeof token === 'string' && token.startsWith('ExponentPushToken');
  }

  /**
   * Send push notification - supports both Expo Push Tokens and FCM tokens
   */
  static async sendPushNotification(tokens, title, body, data = {}) {
    try {
      if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        console.log('⚠️ No push tokens available');
        return;
      }

      // فصل Tokens حسب النوع
      const expoTokens = [];
      const fcmTokens = [];

      tokens.forEach(token => {
        if (this.isExpoToken(token)) {
          expoTokens.push(token);
        } else {
          fcmTokens.push(token);
        }
      });

      const results = [];

      // إرسال Expo Push Tokens عبر Expo API
      if (expoTokens.length > 0) {
        try {
          const expoMessages = expoTokens.map(token => ({
            to: token,
            sound: 'default',
            title: title,
            body: body,
            data: data,
            priority: 'high',
            channelId: 'default',
            android: {
              channelId: 'default',
              priority: 'high',
              sound: 'default',
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1,
                },
              },
            },
          }));

          const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(expoMessages)
          });

          const expoResult = await expoResponse.json();
          
          if (expoResponse.ok && expoResult.data) {
            console.log(`✅ Expo push notifications sent to ${expoTokens.length} token(s)`);
            results.push(expoResult.data);
          } else {
            console.error('❌ Failed to send Expo push notifications:', expoResult);
          }
        } catch (error) {
          console.error('❌ Error sending Expo notifications:', error);
        }
      }

      // إرسال FCM Tokens عبر Expo API (Expo يدعم FCM tokens أيضاً)
      if (fcmTokens.length > 0) {
        try {
          // Expo Push API يدعم FCM tokens إذا كانت في format صحيح
          // لكن الأفضل استخدام Firebase Admin SDK (سنفعله لاحقاً)
          const fcmMessages = fcmTokens.map(token => ({
            to: token,
            sound: 'default',
            title: title,
            body: body,
            data: data,
            priority: 'high',
            channelId: 'default',
            android: {
              channelId: 'default',
              priority: 'high',
              sound: 'default',
            },
          }));

          const fcmResponse = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fcmMessages)
          });

          const fcmResult = await fcmResponse.json();
          
          if (fcmResponse.ok && fcmResult.data) {
            console.log(`✅ FCM push notifications sent to ${fcmTokens.length} token(s)`);
            results.push(fcmResult.data);
          } else {
            console.error('❌ Failed to send FCM push notifications:', fcmResult);
            console.log('💡 Note: FCM tokens may require Firebase Admin SDK for better support');
          }
        } catch (error) {
          console.error('❌ Error sending FCM notifications:', error);
        }
      }

      return results.length > 0 ? results : null;
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

  /**
   * Send push notification to customer by customer ID
   */
  static async notifyCustomerById(customerId, title, body, data = {}) {
    try {
      const Customer = require('../models/Customer');
      const customer = await Customer.findById(customerId);
      
      if (!customer || !customer.expoPushToken) {
        console.log('⚠️ Customer not found or no push token');
        return;
      }

      console.log('📤 Sending push notification to customer...');
      const result = await this.sendPushNotification([customer.expoPushToken], title, body, data);
      
      if (result) {
        console.log('✅ Customer notification sent successfully');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error in notifyCustomerById:', error);
      return null;
    }
  }
}

module.exports = PushNotificationService;

