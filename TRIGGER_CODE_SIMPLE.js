// MongoDB Atlas Trigger - Simple & Working Version
// هذا الكود أبسط ويحتوي على معالجة أخطاء أفضل

exports = async function(changeEvent) {
  try {
    console.log("=== Trigger Started ===");
    
    if (!changeEvent.fullDocument) {
      console.log("No full document");
      return;
    }
    
    const doc = changeEvent.fullDocument;
    console.log("Notification:", doc.title);
    
    // الطريقة الأولى: استخدام context مباشرة
    const mongodb = context.services.get("mongodb-atlas");
    
    if (!mongodb) {
      // محاولة بديلة
      try {
        const altMongo = context.services.get("mongodb");
        if (altMongo) {
          const db = altMongo.db("zajel-app");
          return await processNotification(db, doc);
        }
      } catch (e) {
        console.log("Alternative method failed:", e);
      }
      return;
    }
    
    const db = mongodb.db("zajel-app");
    return await processNotification(db, doc);
    
  } catch (error) {
    console.error("Trigger error:", error.toString());
    throw error;
  }
};

async function processNotification(db, doc) {
  let token = null;
  
  try {
    if (doc.recipient === 'customer' && doc.customerId) {
      const customers = db.collection("customers");
      const customer = await customers.findOne({ _id: doc.customerId });
      if (customer?.expoPushToken) {
        token = customer.expoPushToken;
        console.log("Found customer token");
      }
    }
    
    if (!token && (doc.recipient === 'admin' || !token)) {
      const admins = db.collection("admins");
      const admin = await admins.findOne({ isActive: true, pushToken: { $ne: null } });
      if (admin?.pushToken) {
        token = admin.pushToken;
        console.log("Found admin token");
      }
    }
    
    if (!token) {
      console.log("No token found");
      return;
    }
    
    const message = {
      to: token,
      sound: "default",
      title: doc.title || "إشعار",
      body: doc.message || "",
      data: doc.data || {},
      channelId: "default"
    };
    
    console.log("Sending to Expo...");
    
    const response = await context.http.post({
      url: "https://exp.host/--/api/v2/push/send",
      headers: {
        "Content-Type": ["application/json"],
        "Accept": ["application/json"]
      },
      body: JSON.stringify(message)
    });
    
    console.log("Response:", response.status, response.body.text());
    return response;
    
  } catch (error) {
    console.error("Process error:", error);
    throw error;
  }
}

