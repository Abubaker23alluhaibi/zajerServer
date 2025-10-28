const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'config.env') });

// Manually set environment variables if not loaded
if (!process.env.ADMIN_ID) {
  const envPath = path.join(__dirname, 'config.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0 && !key.startsWith('#')) {
      process.env[key.trim()] = values.join('=').trim();
    }
  });
}

console.log('📋 Environment variables loaded:');
console.log('ADMIN_ID:', process.env.ADMIN_ID);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not set');

// Import routes
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const subAreaRoutes = require('./routes/subAreas');
const configRoutes = require('./routes/config');
const pushTestRoutes = require('./routes/pushTest');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000', 
  'http://localhost:19006', 
  'http://localhost:8081',
  // للتطوير المحلي - استخدم IP الجهاز
  // 'http://192.168.1.54:3000',
  // 'http://192.168.1.54:19006',
  // 'http://192.168.1.54:8081',
  // 'exp://192.168.1.54:8081',
  // لإنتاج - URL السيرفر على Railway (سيتم تعبئته بعد رفع السيرفر)
  // 'https://your-app-name.up.railway.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // في حالة التطوير، اسمح بجميع الأصول
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // في الإنتاج، تحقق من المصادر المسموحة
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ZoomZajel:NajelBassra@cluster0.7ve4xzr.mongodb.net/zajel-app?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
.then(() => {
  console.log('✅ Connected to MongoDB successfully');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sub-areas', subAreaRoutes);
app.use('/api/config', configRoutes);
app.use('/api/push-test', pushTestRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Zajel API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Zajel Delivery API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      customers: '/api/customers',
      orders: '/api/orders',
      admin: '/api/admin',
      health: '/api/health'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🌐 Network API URL: http://192.168.1.54:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
