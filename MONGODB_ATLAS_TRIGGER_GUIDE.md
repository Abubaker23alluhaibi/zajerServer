# دليل إنشاء MongoDB Atlas Trigger للإشعارات التلقائية

## الهدف
إنشاء Trigger في MongoDB Atlas يرسل إشعارات تلقائياً عند إضافة مستند في collection الإشعارات.

---

## الخطوات التنفيذية

### 1. فتح MongoDB Atlas App Services

1. اذهب إلى [MongoDB Atlas](https://cloud.mongodb.com/)
2. اختر مشروعك (Cluster)
3. من القائمة الجانبية، اضغط على **"App Services"**
4. اختر تطبيقك أو أنشئ تطبيق جديد

---

### 2. إنشاء Database Trigger

1. في صفحة App Services، اضغط على **"Triggers"** من القائمة الجانبية
2. اضغط **"Add Trigger"**
3. اختر **"Database"** كـ Type
4. أدخل بيانات التريجر:

#### الإعدادات الأساسية:
- **Name**: `NotifyOnNewNotification`
- **Function**: `onNotificationInsert`
- **Enabled**: نعم

#### Database:
- **Select Cluster**: اختر الكلستر الخاص بك
- **Database Name**: `zajel-app` (أو اسم قاعدة البيانات الخاص بك)
- **Collection Name**: `notifications`
- **Operation Type**: `Insert` فقط

---

### 3. Function Code (الكود)

استخدم هذا الكود في حقل Function:

```javascript
exports = async function(changeEvent) {
  // التحقق من وجود المستند الجديد
  if (!changeEvent.fullDocument) {
    console.log("No full document found");
    return;
  }

  const doc = changeEvent.fullDocument;
  const userId = doc.customerId || doc.recipient;
  
  console.log("🔔 New notification created:", {
    title: doc.title,
    recipient: doc.recipient,
    userId: userId?.toString()
  });

  // جلب Expo Push Token من collection العملاء
  const mongodb = context.services.get("mongodb-atlas");
  const db = mongodb.db("zajel-app");
  
  let expoPushToken = null;
  
  // إذا كانت الإشعار للعميل، جلب token من جدول customers
  if (doc.recipient === 'customer' && doc.customerId) {
    const customersCollection = db.collection("customers");
    const customer = await customersCollection.findOne({ 
      _id: new BSON.ObjectId(doc.customerId.toString())
    });
    
    if (customer && customer.expoPushToken) {
      expoPushToken = customer.expoPushToken;
      console.log("✅ Found customer push token");
    }
  }
  
  // إذا كانت الإشعار للمدير، جلب token من جدول admins
  if (doc.recipient === 'admin') {
    const adminsCollection = db.collection("admins");
    const admin = await adminsCollection.findOne({ 
      isActive: true,
      pushToken: { $ne: null }
    });
    
    if (admin && admin.pushToken) {
      expoPushToken = admin.pushToken;
      console.log("✅ Found admin push token");
    }
  }

  // إذا لم يوجد token، اطبع تحذير واترك
  if (!expoPushToken) {
    console.log("⚠️ No push token found for recipient:", doc.recipient);
    return;
  }

  // إعداد رسالة الإشعار لـ Expo
  const message = {
    to: expoPushToken,
    sound: "default",
    title: doc.title || "إشعار جديد",
    body: doc.message || "لديك إشعار جديد",
    data: doc.data || {},
    channelId: "default"
  };

  console.log("📤 Sending push notification to Expo...");

  try {
    // إرسال الإشعار إلى Expo Push API
    const response = await context.http.post({
      url: "https://exp.host/--/api/v2/push/send",
      headers: {
        "Content-Type": ["application/json"],
        "Accept": ["application/json"]
      },
      body: JSON.stringify(message)
    });

    console.log("✅ Expo push response:", {
      status: response.status,
      statusText: response.statusText,
      body: response.body.text()
    });
    
    return response;
  } catch (error) {
    console.error("❌ Error sending push notification:", error);
    throw error;
  }
};
```

---

### 4. حفظ التريجر

1. اضغط **"Save"** في الأسفل
2. انتظر حتى يصبح التريجر **"Active"** (أخضر)

---

## ملاحظات مهمة

### 1. الأذونات (Permissions)
تأكد من أن المستخدم لديه الصلاحيات التالية:
- `execute_remote_request_action` (لإرسال HTTP requests)
- `read` على collection `notifications`
- `read` على collection `customers`
- `read` على collection `admins`

### 2. Namespace القاعدة
- تأكد أن اسم قاعدة البيانات صحيح (زيت الاستخدام: `zajel-app`)
- تأكد أن اسم الـ collection صحيح (`notifications`, `customers`, `admins`)

### 3. BSON ObjectId
- عند البحث عن customerId، تأكد من تحويله إلى `BSON.ObjectId()`

---

## اختبار التريجر

### طريقة الاختبار اليدوي:
1. اذهب إلى MongoDB Atlas → Data Browser
2. اختر collection `notifications`
3. اضغط **"Insert Document"**
4. أدخل مستند تجريبي:

```json
{
  "type": "order_status_update",
  "title": "اختبار الإشعار",
  "message": "هذا إشعار تجريبي",
  "recipient": "customer",
  "customerId": "ObjectId('YOUR_CUSTOMER_ID')",
  "isRead": false,
  "priority": "normal",
  "createdAt": {
    "$date": "2024-01-01T00:00:00Z"
  }
}
```

5. احفظ المستند
6. **النتيجة المتوقعة**: يجب أن تصل إشعار على الجهاز بصوت!

---

## استكشاف الأخطاء

### إذا لم تصل الإشعارات:
1. تأكد أن Push Token محفوظ في قاعدة البيانات
2. افتح Logs في Atlas App Services
3. ابحث عن الأخطاء (Errors)
4. تحقق من أن HTTP request وصل بنجاح

### إذا كان التريجر لا يعمل:
1. تأكد أن التريجر **Enabled**
2. تأكد من صحة اسم الـ Database والـ Collection
3. تأكد من أن الـ operation type هو `Insert`

---

## النتيجة النهائية

بعد تطبيق هذا الـ Trigger:
- كل مرة يتم إدخال مستند في `notifications`
- الـ Trigger يعمل تلقائياً
- يجلب Expo Push Token من جدول العميل أو المدير
- يرسل إشعار مباشرة إلى الجهاز
- الإشعار **يعمل بصوت حتى والتطبيق مغلق** ✅

---

## صورة توضيحية للـ Trigger Structure

```
MongoDB Atlas
└── App Services
    └── Triggers
        └── NotifyOnNewNotification
            ├── Type: Database
            ├── Collection: notifications
            ├── Operation: Insert
            └── Function: [الكود أعلاه]
```

---

## روابط مفيدة
- [MongoDB Atlas Documentation](https://www.mongodb.com/docs/atlas/)
- [Atlas Triggers Guide](https://www.mongodb.com/docs/atlas/app-services/triggers/database-triggers/)
- [Expo Push Notifications API](https://docs.expo.dev/push-notifications/sending-notifications/)

