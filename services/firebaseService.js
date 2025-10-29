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
          priority: 'high', // مهم جداً للإشعارات خارج التطبيق
          notification: {
            channelId: 'default', // يجب أن يطابق القناة في التطبيق
            sound: 'default',
            priority: 'high', // HIGH أو MAX للإشعارات المهمة
            defaultSound: true,
            defaultVibrateTimings: true,
            visibility: 'public', // إظهار الإشعار حتى مع شاشة القفل
            icon: 'ic_notification', // سيتم استخدامه إذا كان موجود
            color: '#2196F3', // لون الإشعار
          },
          ttl: 86400000, // 24 ساعة (time to live للإشعار)
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
              category: 'ORDER_NOTIFICATION', // فئة الإشعار
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
    // For Android FCM tokens from Expo, the format is typically "projectNumber:actualToken"
    // We should take the part AFTER the colon as it's the actual FCM token
    if (trimmedToken.includes(':')) {
      const parts = trimmedToken.split(':');
      if (parts.length >= 2) {
        // Take the part after the colon (typically the actual FCM token)
        // For Android: "projectNumber:FCM_TOKEN" -> use FCM_TOKEN
        trimmedToken = parts.slice(1).join(':'); // In case there are multiple colons
      } else {
        // Fallback: take the longest part if split didn't work as expected
        trimmedToken = parts.reduce((longest, part) => 
          part.length > longest.length ? part : longest, ''
        );
      }
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
    
      // Store original tokens for fallback
      const originalTokens = [...tokens];
      
      tokens.forEach((token, idx) => {
      // Normalize token - extract actual token if it has a colon
      let normalizedToken = typeof token === 'string' ? token.trim() : String(token).trim();
      const originalToken = normalizedToken;
      
      // Handle tokens with colons (format: "prefix:actualToken")
      // For Android FCM tokens from Expo, the format is typically "projectNumber:actualToken"
      // We should take the part AFTER the colon as it's the actual FCM token
      if (normalizedToken.includes(':')) {
        const parts = normalizedToken.split(':');
        if (parts.length >= 2) {
          // Take the part after the colon (typically the actual FCM token)
          // For Android: "projectNumber:FCM_TOKEN" -> use FCM_TOKEN
          normalizedToken = parts.slice(1).join(':'); // In case there are multiple colons
        } else {
          // Fallback: take the longest part if split didn't work as expected
          normalizedToken = parts.reduce((longest, part) => 
            part.length > longest.length ? part : longest, ''
          );
        }
      }
      
      if (this.isValidFCMToken(normalizedToken)) {
        // Store both original and normalized for fallback attempt
        validTokens.push({ 
          normalized: normalizedToken, 
          original: originalToken,
          hasColon: originalToken.includes(':')
        });
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
          body: body
          // لا يمكن إضافة sound هنا - يجب أن يكون في android.notification أو apns.payload.aps
        },
        data: stringData,
        android: {
          priority: 'high', // مهم جداً للإشعارات خارج التطبيق
          // إضافة clickAction لضمان إظهار الإشعار في الخلفية
          notification: {
            channelId: 'default', // يجب أن يطابق القناة في التطبيق
            sound: 'default',
            priority: 'high', // HIGH أو MAX للإشعارات المهمة
            defaultSound: true,
            defaultVibrateTimings: true,
            visibility: 'public', // إظهار الإشعار حتى مع شاشة القفل
            // إضافة icon و color للإشعار
            icon: 'ic_notification', // سيتم استخدامه إذا كان موجود
            color: '#2196F3', // لون الإشعار
          },
          // إعدادات إضافية لضمان وصول الإشعار
          ttl: 86400000, // 24 ساعة (time to live للإشعار)
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
              category: 'ORDER_NOTIFICATION', // فئة الإشعار
            },
          },
        },
        // إعدادات إضافية لضمان الإظهار
        fcmOptions: {
          // رابط الصورة إذا كان هناك صورة للإشعار
        },
      };

      // Extract tokens for sending - محاولة Token الأصلي أولاً إذا كان لديه colon
      // لأن Expo قد يرسل token بصيغة خاصة يجب تجربتها كما هي
      const tokensToSend = validTokens.map(t => {
        if (typeof t === 'object' && t.hasColon) {
          // إذا كان Token لديه colon، جرب الأصل أولاً (قد يكون Expo format صحيح)
          return t.original;
        }
        return typeof t === 'object' ? t.normalized : t;
      });
      
      console.log(`🔥 Attempting to send to ${tokensToSend.length} token(s)`);
      console.log(`📝 First token preview: ${tokensToSend[0]?.substring(0, 60)}...`);
      console.log(`📝 Token format check: ${tokensToSend[0]?.includes(':') ? 'Has prefix (will try as-is first)' : 'No prefix (normalized)'}`);
      
      const response = await admin.messaging().sendEachForMulticast({
        ...message,
        tokens: tokensToSend,
      });
      
      console.log(`✅ Firebase notifications sent: ${response.successCount}/${validTokens.length} successful`);
      
      if (response.failureCount > 0) {
        console.log(`⚠️ ${response.failureCount} notifications failed`);
        const invalidTokenIndices = [];
        const retryPromises = [];
        
        for (let idx = 0; idx < response.responses.length; idx++) {
          const resp = response.responses[idx];
          if (!resp.success) {
            const errorCode = resp.error?.code;
            const errorMessage = resp.error?.message;
            console.log(`  ❌ Token ${idx}: ${errorMessage}`);
            
            // Track tokens that need to be removed from database
            // Only remove tokens for actual token errors, not payload errors
            if (errorCode === 'messaging/invalid-registration-token' || 
                errorCode === 'messaging/registration-token-not-registered') {
              // Try normalized token if original failed (عكس الماضي - الآن جربنا الأصل أولاً)
              const tokenInfo = validTokens[idx];
              if (tokenInfo && typeof tokenInfo === 'object' && tokenInfo.hasColon) {
                // إذا استخدمنا الأصل وفشل، جرب normalized
                const currentToken = tokensToSend[idx];
                const isOriginal = currentToken === tokenInfo.original;
                
                if (isOriginal && tokenInfo.normalized !== tokenInfo.original) {
                  console.log(`  🔄 Retrying with normalized token (without prefix) for token ${idx}...`);
                  // Create retry promise
                  retryPromises.push(
                    admin.messaging().send({
                      ...message,
                      token: tokenInfo.normalized,
                    })
                    .then((normalizedResponse) => {
                      console.log(`  ✅ Retry with normalized token succeeded for token ${idx}`);
                      return { success: true, idx };
                    })
                    .catch((retryError) => {
                      console.log(`  ❌ Retry with normalized token also failed: ${retryError.message}`);
                      invalidTokenIndices.push(tokensToSend[idx]);
                      console.log(`  🗑️ Marking token ${idx} for removal (both original and normalized failed)`);
                      return { success: false, idx };
                    })
                  );
                } else {
                  invalidTokenIndices.push(tokensToSend[idx]);
                  console.log(`  🗑️ Marking token ${idx} for removal (invalid or unregistered)`);
                }
              } else {
                invalidTokenIndices.push(tokensToSend[idx]);
                console.log(`  🗑️ Marking token ${idx} for removal (invalid or unregistered)`);
              }
            } else {
              // Payload errors or other errors don't mean the token is invalid
              console.log(`  ⚠️ Token ${idx} is valid but notification failed due to: ${errorCode}`);
            }
          }
        }
        
        // Wait for all retries to complete
        if (retryPromises.length > 0) {
          await Promise.all(retryPromises);
        }
        
        // Remove only truly invalid tokens from database
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

