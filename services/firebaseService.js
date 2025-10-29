// Firebase service for push notifications
const admin = require('firebase-admin');

// Initialize Firebase Admin using Environment Variables (لـ Railway)
let firebaseInitialized = false;

try {
  if (!admin.apps.length) {
    // استخدام Environment Variables بدلاً من ملف JSON
    const firebaseConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    if (firebaseConfig.projectId && firebaseConfig.privateKey && firebaseConfig.clientEmail) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig)
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized successfully');
    } else {
      console.log('⚠️ Firebase environment variables not set, Firebase Admin disabled');
    }
  } else {
    firebaseInitialized = true;
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error.message);
  firebaseInitialized = false;
}

class FirebaseMessagingService {
  static async sendToToken(fcmToken, title, body, data = {}) {
    if (!firebaseInitialized) {
      console.log('⚠️ Firebase not initialized, skipping FCM notification');
      return null;
    }

    try {
      const message = {
        notification: { 
          title: title,
          body: body
        },
        data: {
          ...data,
          sound: 'default',
          priority: 'high',
        },
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
      const message = {
        notification: { 
          title: title,
          body: body
        },
        data: {
          ...data,
          sound: 'default',
        },
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

