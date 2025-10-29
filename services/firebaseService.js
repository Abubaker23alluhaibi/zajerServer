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

  static async sendToTokens(tokens, title, body, data = {}) {
    if (!firebaseInitialized) {
      console.log('⚠️ Firebase not initialized, skipping FCM notifications');
      return null;
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ No FCM tokens provided');
      return null;
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
      };

      // إرسال للعديد من tokens
      const response = await admin.messaging().sendEachForMulticast({
        ...message,
        tokens: tokens,
      });
      
      console.log(`✅ Firebase notifications sent: ${response.successCount}/${tokens.length} successful`);
      
      if (response.failureCount > 0) {
        console.log(`⚠️ ${response.failureCount} notifications failed`);
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.log(`  ❌ Token ${idx}: ${resp.error?.message}`);
          }
        });
      }
      
      return response;
    } catch (error) {
      console.error('❌ Firebase send error:', error.message);
      throw error;
    }
  }
}

module.exports = FirebaseMessagingService;

