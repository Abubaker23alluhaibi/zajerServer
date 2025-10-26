const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Admin = require('../models/Admin');

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Customer login
const customerLogin = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'رقم الهاتف وكلمة المرور مطلوبان'
      });
    }

    const customer = await Customer.findOne({ phoneNumber });
    
    if (!customer) {
      return res.status(401).json({
        status: 'error',
        message: 'العميل غير مسجل في النظام'
      });
    }

    if (customer.status === 'suspended') {
      return res.status(401).json({
        status: 'error',
        message: 'حسابك معلق. يرجى التواصل مع الإدارة'
      });
    }

    const isPasswordValid = await customer.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'كلمة المرور غير صحيحة'
      });
    }

    const token = generateToken({
      customerId: customer._id,
      phoneNumber: customer.phoneNumber,
      storeName: customer.storeName,
      userType: 'customer'
    });

    res.status(200).json({
      status: 'success',
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        token,
        customer: {
          id: customer._id,
          storeName: customer.storeName,
          phoneNumber: customer.phoneNumber,
          area: customer.area,
          totalOrders: customer.totalOrders,
          status: customer.status
        }
      }
    });
  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تسجيل الدخول'
    });
  }
};

// Admin login
const adminLogin = async (req, res) => {
  try {
    const { adminId, adminCode } = req.body;

    if (!adminId || !adminCode) {
      return res.status(400).json({
        status: 'error',
        message: 'معرف الإدارة والرمز السري مطلوبان'
      });
    }

    // Find admin in database
    const admin = await Admin.findOne({ adminId: adminId.trim() });
    
    if (!admin) {
      return res.status(401).json({
        status: 'error',
        message: 'معرف الإدارة غير صحيح'
      });
    }

    if (!admin.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'حساب الإدارة معطل'
      });
    }

    // Compare secret code
    const isCodeValid = await admin.compareSecretCode(adminCode.trim());
    
    if (!isCodeValid) {
      return res.status(401).json({
        status: 'error',
        message: 'الرمز السري غير صحيح'
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken({
      adminId: admin._id,
      adminIdString: admin.adminId,
      role: admin.role,
      userType: 'admin'
    });

    res.status(200).json({
      status: 'success',
      message: 'تم تسجيل دخول الإدارة بنجاح',
      data: {
        token,
        admin: {
          adminId: admin.adminId,
          name: admin.name,
          role: admin.role,
          userType: 'admin'
        }
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تسجيل دخول الإدارة'
    });
  }
};

// Get customer profile
const getCustomerProfile = async (req, res) => {
  try {
    const customer = req.customer;
    
    res.status(200).json({
      status: 'success',
      data: {
        customer: {
          id: customer._id,
          storeName: customer.storeName,
          phoneNumber: customer.phoneNumber,
          area: customer.area,
          totalOrders: customer.totalOrders,
          status: customer.status,
          lastOrderDate: customer.lastOrderDate,
          createdAt: customer.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب بيانات الملف الشخصي'
    });
  }
};

// Update admin settings
const updateAdminSettings = async (req, res) => {
  try {
    const { adminId, secretCode } = req.body;

    // Note: This feature is currently disabled
    // Admin credentials are stored in .env file for security
    // To change admin credentials, edit backend/config.env file
    
    return res.status(403).json({
      status: 'error',
      message: 'تحديث بيانات الإدارة غير مدعوم حالياً. يرجى تعديل ملف config.env يدوياً'
    });
  } catch (error) {
    console.error('Update admin settings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تحديث إعدادات الإدارة'
    });
  }
};

// Get admin settings
const getAdminSettings = async (req, res) => {
  try {
    // Return admin settings from .env file
    res.status(200).json({
      status: 'success',
      data: {
        admin: {
          adminId: process.env.ADMIN_ID || 'admin2024'
        }
      }
    });
  } catch (error) {
    console.error('Get admin settings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب إعدادات الإدارة'
    });
  }
};

module.exports = {
  customerLogin,
  adminLogin,
  getCustomerProfile,
  updateAdminSettings,
  getAdminSettings
};

