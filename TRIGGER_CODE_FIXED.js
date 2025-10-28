// MongoDB Atlas Trigger Code - Fixed Version
// انسخ هذا الكود في Function الخاص بالـ Trigger

exports = async function(changeEvent) {
  console.log("🚀 Trigger started:", changeEvent);
  
  // التحقق من وجود المستند الجديد
  if (!changeEvent.fullDocument) {
    console.log("❌ No full document found");
    return;
  }

  const doc = changeEvent.fullDocument;
  console.log("📄 Full Document:", JSON.stringify(doc, null, 2));

  // جلب MongoDB service
  const mongodb = context.services.get("mongodb-atlas");
  console.log("📊 MongoDB service:", mongodb ? "✅ Found" : "❌ Not found");

  if (!mongodb) {
    console.error("❌ MongoDB service not available");
    return;
  }

  const db = mongodb.db("zajel-app");
  console.log("📁 Database:", db ? "✅ Connected" : "❌ Failed");

  let expoPushToken = null;

  try {
    // إذا كانت الإشعار للعميل
    if (doc.recipient === 'customer' && doc.customerId) {
      console.log("👤 Looking for customer token...");
      const customersCollection = db.collection("customers");
      
      const customerId = typeof doc.customerId === 'string' 
        ? BSON.ObjectId(doc.customerId) 
        : doc.customerId;
      
      const customer = await customersCollection.findOne({ _id: customerId });
      
      console.log("👤 Customer found:", customer ? "✅" : "❌");
      
      if (customer && customer.expoPushToken) {
        expoPushToken = customer.expoPushToken;
        console.log("✅ Customer push token found:", expoPushToken.substring(0, 20) + "...");
      } else {
        console.log("⚠️ Customer found but no push token");
      }
    }
    
    // إذا كانت الإشعار للمدير
    if (doc.recipient === 'admin' || !expoPushToken) {
      console.log("👔 Looking for admin token...");
      const adminsCollection = db.collection("admins");
      
      const admin = await adminsCollection.findOne({ 
        isActive: true,
        pushToken: { $ne: null }
      });
      
      console.log("👔 Admin found:", admin ? "✅" : "❌");
      
      if (admin && admin.pushToken) {
        expoPushToken = admin.pushToken;
        console.log("✅ Admin push token found:", expoPushToken.substring(0, 20) + "...");
      }
    }

    // إذا لم يوجد token
    if (!expoPushToken) {
      console.log("⚠️ No push token found for recipient:", doc.recipient);
      console.log("📝 Notification will not be sent");
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
    console.log("📨 Message:", JSON.stringify(message, null, 2));

    // إرسال الإشعار إلى Expo Push API
    const response = await context.http.post({
      url: "https://exp.host/--/api/v2/push/send",
      headers: {
        "Content-Type": ["application/json"],
        "Accept": ["application/json"]
      },
      body: JSON.stringify(message)
    });

    console.log("✅ Expo push response:");
    console.log("   Status:", response.status);
    console.log("   StatusText:", response.statusText);
    console.log("   Body:", response.body.text());

    return response;
    
  } catch (error) {
    console.error("❌ Error in trigger:", error);
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
    throw error;
  }
};

