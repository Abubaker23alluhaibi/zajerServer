// Firebase service for push notifications
const admin = require('firebase-admin');

// Initialize Firebase Admin using Environment Variables (لـ Railway)
let firebaseInitialized = false;

try {
  if (!admin.apps.length) {
    // استخدام Environment Variables بدلاً من ملف JSON
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    // معالجة الـ private key - استبدال \\n بـ \n حقيقي
    if (privateKey) {
      // إزالة أي مسافات في البداية والنهاية
      privateKey = privateKey.trim();
      
      // استبدال \\n بـ \n (للمتغيرات البيئة في Railway)
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      // تأكد من أن الـ key يبدأ وينتهي بشكل صحيح
      if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
        privateKey = '-----BEGIN PRIVATE KEY-----\n' + privateKey;
      }
      if (!privateKey.endsWith('-----END PRIVATE KEY-----')) {
        privateKey = privateKey + '\n-----END PRIVATE KEY-----';
      }
    }
    
    const firebaseConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: privateKey,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    if (firebaseConfig.projectId && firebaseConfig.privateKey && firebaseConfig.clientEmail) {
      // التحقق من أن الـ private key صحيح قبل المحاولة
      if (!firebaseConfig.privateKey.includes('BEGIN PRIVATE KEY')) {
        throw new Error('Invalid private key format - missing BEGIN PRIVATE KEY');
      }
      
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig)
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized successfully');
      console.log('📱 Project ID:', firebaseConfig.projectId);
      console.log('📧 Client Email:', firebaseConfig.clientEmail);
    } else {
      console.log('⚠️ Firebase environment variables not set, Firebase Admin disabled');
      if (!firebaseConfig.projectId) console.log('  ❌ Missing FIREBASE_PROJECT_ID');
      if (!firebaseConfig.privateKey) console.log('  ❌ Missing FIREBASE_PRIVATE_KEY');
      if (!firebaseConfig.clientEmail) console.log('  ❌ Missing FIREBASE_CLIENT_EMAIL');
    }
  } else {
    firebaseInitialized = true;
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error.message);
  console.error('💡 Make sure FIREBASE_PRIVATE_KEY is correctly formatted with \\n for newlines');
  firebaseInitialized = false;
}

class FirebaseMessagingService {
  static async sendToToken(fcmToken, title, body, data = {}) {
    if (!firebaseInitialized) {
      console.log('⚠️ Firebase not initialized, skipping FCM notification');
      return null;
    }

    try {
      // تحويل جميع قيم data إلى strings (Firebase يتطلب strings فقط)
      const stringData = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
          stringData[key] = String(value);
        }
      }

      const message = {
        notification: { 
          title: title,
          body: body
        },
        data: stringData,
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        token: fcmToken,
      };

      const response = await admin.messaging().send(message);
      console.log('✅ Firebase notification sent successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Firebase send error:', error.message);
      
      // إذا كان Token غير صحيح أو منتهي الصلاحية
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        console.log('⚠️ Invalid or expired FCM token');
      }
      
      throw error;
    }
  }

  /**
   * Validate FCM token format
   * Handles various FCM token formats including those with colons
   */
  static isValidFCMToken(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    // Trim whitespace
    let trimmedToken = token.trim();
    
    // Check if it's not an Expo token (Expo tokens start with ExponentPushToken)
    if (trimmedToken.startsWith('ExponentPushToken')) {
      return false;
    }
    
    // Handle tokens that might have a prefix before the actual FCM token
    // Format: "prefix:actualToken" or just "actualToken"
    // Extract the actual token part if there's a colon
    if (trimmedToken.includes(':')) {
      const parts = trimmedToken.split(':');
      // Take the longest part (likely the actual token)
      // FCM tokens are typically much longer than prefixes
      trimmedToken = parts.reduce((longest, part) => 
        part.length > longest.length ? part : longest, ''
      );
    }
    
    // FCM/APNs tokens can vary in length:
    // - APNs tokens are typically 64 characters (hex)
    // - FCM tokens are typically 152+ characters (base64-like)
    // Accept tokens that are at least 32 characters (minimum valid length)
    if (trimmedToken.length < 32) {
      return false;
    }
    
    // FCM/APNs tokens don't contain spaces or certain special characters
    if (trimmedToken.includes(' ') || trimmedToken.includes('\n') || trimmedToken.includes('\r')) {
      return false;
    }
    
    // Check if it looks like a valid token (alphanumeric and some special chars like - _ :)
    // Allow colons for compatibility with various token formats
    const tokenPattern = /^[a-zA-Z0-9_:.-]+$/;
    if (!tokenPattern.test(trimmedToken)) {
      return false;
    }
    
    return true;
  }

  static async sendToTokens(tokens, title, body, data = {}) {
    if (!firebaseInitialized) {
      console.log('⚠️ Firebase not initialized, skipping FCM notifications');
      return null;
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ No FCM tokens provided');
      return null;
    }

    // Filter out invalid tokens before sending
    const validTokens = [];
    const invalidTokens = [];
    
      tokens.forEach((token, idx) => {
      // Normalize token - extract actual token if it has a colon
      let normalizedToken = typeof token === 'string' ? token.trim() : String(token).trim();
      
      // Handle tokens with colons (format: "prefix:actualToken")
      if (normalizedToken.includes(':')) {
        const parts = normalizedToken.split(':');
        // Take the longest part (likely the actual FCM token)
        normalizedToken = parts.reduce((longest, part) => 
          part.length > longest.length ? part : longest, ''
        );
      }
      
      if (this.isValidFCMToken(normalizedToken)) {
        validTokens.push(normalizedToken); // Use normalized token
      } else {
        invalidTokens.push({ index: idx, token: normalizedToken.substring(0, 30) + '...' });
        console.log(`⚠️ Invalid FCM token ${idx}: ${normalizedToken.substring(0, 50)}... (length: ${normalizedToken.length})`);
      }
    });

    if (invalidTokens.length > 0) {
      console.log(`⚠️ Filtered out ${invalidTokens.length} invalid FCM token(s)`);
    }

    if (validTokens.length === 0) {
      console.log('⚠️ No valid FCM tokens to send');
      return { successCount: 0, failureCount: tokens.length, responses: [] };
    }

    try {
      // تحويل جميع قيم data إلى strings (Firebase يتطلب strings فقط)
      const stringData = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
          // تحويل أي قيمة إلى string (ObjectId, numbers, etc.)
          stringData[key] = String(value);
        }
      }

      const message = {
        notification: { 
          title: title,
          body: body,
          sound: 'default', // إضافة الصوت في المستوى الأساسي أيضاً
        },
        data: stringData,
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: { 
              sound: 'default',
              badge: 1,
              alert: {
                title: title,
                body: body,
              },
              'content-available': 1, // للإشعارات في الخلفية
            },
          },
        },
      };

      // إرسال للعديد من tokens
      const response = await admin.messaging().sendEachForMulticast({
        ...message,
        tokens: validTokens,
      });
      
      console.log(`✅ Firebase notifications sent: ${response.successCount}/${validTokens.length} successful`);
      
      if (response.failureCount > 0) {
        console.log(`⚠️ ${response.failureCount} notifications failed`);
        const invalidTokenIndices = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            const errorMessage = resp.error?.message;
            console.log(`  ❌ Token ${idx}: ${errorMessage}`);
            
            // Track tokens that need to be removed from database
            if (errorCode === 'messaging/invalid-registration-token' || 
                errorCode === 'messaging/registration-token-not-registered' ||
                errorCode === 'messaging/invalid-argument') {
              invalidTokenIndices.push(validTokens[idx]);
            }
          }
        });
        
        // Remove invalid tokens from database
        if (invalidTokenIndices.length > 0) {
          await this.removeInvalidTokens(invalidTokenIndices);
        }
      }
      
      // Return response with adjusted counts to include filtered tokens as failures
      return {
        ...response,
        failureCount: response.failureCount + invalidTokens.length,
        successCount: response.successCount
      };
    } catch (error) {
      console.error('❌ Firebase send error:', error.message);
      throw error;
    }
  }

  /**
   * Remove invalid tokens from Admin collection
   */
  static async removeInvalidTokens(invalidTokens) {
    try {
      const Admin = require('../models/Admin');
      const updatePromises = invalidTokens.map(token => 
        Admin.updateMany(
          { pushToken: token },
          { $set: { pushToken: null } }
        )
      );
      
      await Promise.all(updatePromises);
      console.log(`🧹 Removed ${invalidTokens.length} invalid token(s) from database`);
    } catch (error) {
      console.error('❌ Error removing invalid tokens:', error.message);
    }
  }
}

module.exports = FirebaseMessagingService;

