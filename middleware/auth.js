const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'رمز المصادقة مطلوب'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if customer exists
    const customer = await Customer.findById(decoded.customerId);
    if (!customer) {
      return res.status(401).json({
        status: 'error',
        message: 'العميل غير موجود'
      });
    }

    if (customer.status !== 'active') {
      return res.status(401).json({
        status: 'error',
        message: 'حسابك معلق أو غير نشط'
      });
    }

    req.customer = customer;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'رمز المصادقة غير صحيح'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'انتهت صلاحية رمز المصادقة'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'خطأ في المصادقة'
    });
  }
};

const adminAuthMiddleware = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'رمز المصادقة مطلوب'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.userType !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'ليس لديك صلاحية للوصول'
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'رمز المصادقة غير صحيح'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'انتهت صلاحية رمز المصادقة'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'خطأ في المصادقة'
    });
  }
};

module.exports = {
  authMiddleware,
  adminAuthMiddleware
};

