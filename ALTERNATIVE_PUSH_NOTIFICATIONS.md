# 🔄 الحل البديل: إرسال الإشعارات بدون Atlas Trigger

إذا الـ Trigger ما عمل، نستخدم **Express Endpoint** يرسل الإشعارات تلقائياً.

---

## ✅ الخطوات:

### 1️⃣ إنشاء Express Endpoint جديد

أنشئ ملف `backend/routes/pushTest.js`:

```javascript
const express = require('express');
const router = express.Router();
const PushNotificationService = require('../services/pushNotificationService');

// إرسال إشعار تجريبي
router.post('/test', async (req, res) => {
  const { recipient, customerId, title, message } = req.body;
  
  try {
    let expoPushToken = null;
    
    if (recipient === 'customer' && customerId) {
      const Customer = require('../models/Customer');
      const customer = await Customer.findById(customerId);
      if (customer?.expoPushToken) {
        expoPushToken = customer.expoPushToken;
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
      }
    }
    
    if (!expoPushToken) {
      return res.status(404).json({
        status: 'error',
        message: 'No push token found'
      });
    }
    
    await PushNotificationService.sendPushNotification(
      [expoPushToken],
      title || 'إشعار تجريبي',
      message || 'هذا إشعار تجريبي',
      {}
    );
    
    res.json({
      status: 'success',
      message: 'Notification sent'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
```

---

### 2️⃣ إضافته في `server.js`:

```javascript
const pushTestRoutes = require('./routes/pushTest');
app.use('/api/push-test', pushTestRoutes);
```

---

### 3️⃣ استدعاءه بعد إنشاء Notification:

في `notificationService.js`:

```javascript
// بعد إنشاء الإشعار
const notification = await this.createNotification({
  type: 'new_order',
  title: 'طلب جديد!',
  message: `طلب جديد من ${order.storeName}`,
  recipient: 'admin',
  orderId: order._id,
  customerId: order.customerId._id
});

// إرسال Push Notification عبر Express
if (notification.recipient === 'admin') {
  const Admin = require('../models/Admin');
  const admin = await Admin.findOne({ isActive: true, pushToken: { $ne: null } });
  
  if (admin?.pushToken) {
    await PushNotificationService.sendPushNotification(
      [admin.pushToken],
      notification.title,
      notification.message,
      { notificationId: notification._id }
    );
  }
}
```

---

## 🧪 اختبار:

```bash
# من Postman أو Terminal:
curl -X POST https://your-backend.com/api/push-test/test \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "admin",
    "title": "اختبار",
    "message": "هذا اختبار"
  }'
```

---

## ✅ الفوائد:

- ✅ أسهل من Atlas Trigger
- ✅ أكثر موثوقية
- ✅ تقدر تتحكم فيه من Express
- ✅ تقدر تشوف Logs في Railway
- ✅ يعمل بنفس الطريقة

---

## 🎯 النتيجة:

**بدلاً من:** MongoDB Trigger → Expo

**تصير:** Express Code → Push Service → Expo

**النتيجة نفسها!** ✅

