const fetch = require('node-fetch');
const FirebaseMessagingService = require('./firebaseService');

class PushNotificationService {
  /**
   * Check if token is Expo Push Token or FCM token
   */
  static isExpoToken(token) {
    return token && typeof token === 'string' && token.startsWith('ExponentPushToken');
  }

  /**
   * Validate and filter tokens
   */
  static validateTokens(tokens) {
    const validExpoTokens = [];
    const validFCMTokens = [];
    const invalidTokens = [];

    tokens.forEach((token, idx) => {
      if (!token || typeof token !== 'string') {
        invalidTokens.push({ index: idx, reason: 'empty or not a string' });
        return;
      }

      // Trim whitespace
      const trimmedToken = token.trim();

      if (trimmedToken.length === 0) {
        invalidTokens.push({ index: idx, reason: 'empty after trimming' });
        return;
      }

      if (this.isExpoToken(trimmedToken)) {
        validExpoTokens.push(trimmedToken);
        console.log(`📝 Token ${idx} identified as Expo: ${trimmedToken.substring(0, 30)}...`);
      } else {
        // Check if it looks like a valid FCM token
        if (FirebaseMessagingService.isValidFCMToken(trimmedToken)) {
          validFCMTokens.push(trimmedToken);
          console.log(`📝 Token ${idx} identified as FCM: ${trimmedToken.substring(0, 30)}...`);
        } else {
          invalidTokens.push({ 
            index: idx, 
            reason: `invalid format (length: ${trimmedToken.length}, preview: ${trimmedToken.substring(0, 20)}...)` 
          });
          console.log(`⚠️ Token ${idx} is invalid: ${trimmedToken.substring(0, 50)}... (length: ${trimmedToken.length})`);
        }
      }
    });

    if (invalidTokens.length > 0) {
      console.log(`⚠️ Found ${invalidTokens.length} invalid token(s):`, invalidTokens.map(t => t.reason).join(', '));
    }

    return { validExpoTokens, validFCMTokens, invalidTokens };
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

      // Validate and separate tokens by type
      const { validExpoTokens, validFCMTokens, invalidTokens } = this.validateTokens(tokens);

      console.log(`📊 Tokens breakdown: ${validExpoTokens.length} Expo, ${validFCMTokens.length} FCM, ${invalidTokens.length} invalid`);

      // Remove invalid tokens from database
      if (invalidTokens.length > 0) {
        await this.removeInvalidTokensFromDatabase(tokens, invalidTokens);
      }

      const results = [];

      // إرسال Expo Push Tokens عبر Expo API
      if (validExpoTokens.length > 0) {
        try {
          const expoMessages = validExpoTokens.map(token => ({
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
            console.log(`✅ Expo push notifications sent to ${validExpoTokens.length} token(s)`);
            results.push(expoResult.data);
          } else {
            console.error('❌ Failed to send Expo push notifications:', expoResult);
          }
        } catch (error) {
          console.error('❌ Error sending Expo notifications:', error);
        }
      }

      // إرسال FCM Tokens عبر Firebase Admin SDK
      if (validFCMTokens.length > 0) {
        try {
          console.log(`🔥 Sending ${validFCMTokens.length} FCM notification(s) via Firebase Admin SDK...`);
          
          // استخدام Firebase Admin SDK لإرسال FCM tokens
          const firebaseResult = await FirebaseMessagingService.sendToTokens(
            validFCMTokens,
            title,
            body,
            data
          );
          
          if (firebaseResult) {
            console.log(`✅ FCM notifications sent successfully via Firebase`);
            results.push(firebaseResult);
          } else {
            console.log('⚠️ Firebase service returned null (may not be initialized)');
            // Fallback: محاولة عبر Expo API (لن تعمل لكن نجرب)
            console.log('⚠️ Attempting fallback via Expo API (will likely fail)...');
          }
        } catch (error) {
          console.error('❌ Error sending FCM notifications via Firebase:', error.message);
          console.log('💡 Make sure FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL are set');
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
   * Remove invalid tokens from database
   */
  static async removeInvalidTokensFromDatabase(allTokens, invalidTokenObjects) {
    try {
      const Admin = require('../models/Admin');
      
      // Get the actual invalid token values
      const invalidTokenValues = invalidTokenObjects
        .map(item => {
          const token = allTokens[item.index];
          return token ? token.trim() : null;
        })
        .filter(Boolean);
      
      if (invalidTokenValues.length > 0) {
        // Remove invalid tokens from admin collection
        const result = await Admin.updateMany(
          { pushToken: { $in: invalidTokenValues } },
          { $set: { pushToken: null } }
        );
        console.log(`🧹 Removed ${invalidTokenValues.length} invalid token(s) from database (matched: ${result.matchedCount}, updated: ${result.modifiedCount})`);
      }
    } catch (error) {
      console.error('❌ Error removing invalid tokens from database:', error.message);
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

