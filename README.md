# Zajel Server - Backend API

Backend API لتطبيق زاجل توصيل الطلبات

## التقنيات المستخدمة

- Node.js
- Express.js
- MongoDB (MongoDB Atlas)
- JWT Authentication
- Bcrypt for Password Hashing

## التثبيت والتشغيل

### المحلي:
```bash
cd backend
npm install
npm start
```

### على Railway:
السيرفر يعمل تلقائياً بعد الرفع على Railway

## المتغيرات البيئة المطلوبة

- `MONGODB_URI` - رابط قاعدة البيانات
- `PORT` - رقم المنفذ (افتراضي: 5000)
- `JWT_SECRET` - مفتاح JWT
- `ADMIN_ID` - معرف الإدارة
- `ADMIN_SECRET_CODE` - الرمز السري للإدارة
- `NODE_ENV` - بيئة التشغيل (development/production)

## API Endpoints

- `/api/auth` - المصادقة
- `/api/customers` - إدارة العملاء
- `/api/orders` - إدارة الطلبات
- `/api/admin` - لوحة الإدارة
- `/api/notifications` - الإشعارات
- `/api/sub-areas` - المناطق
- `/api/config` - الإعدادات
- `/api/health` - فحص الحالة

## المؤلف

Zajel Team
