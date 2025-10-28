const Customer = require('../models/Customer');
const Order = require('../models/Order');
const NotificationService = require('../services/notificationService');

// Get all customers
const getAllCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, area, status } = req.query;
    
    const filter = {};
    if (area) filter.area = area;
    if (status) filter.status = status;

    const customers = await Customer.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Customer.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        customers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalCustomers: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب قائمة العملاء'
    });
  }
};

// Get customer by ID
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await Customer.findById(id).select('-password');
    
    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'العميل غير موجود'
      });
    }

    // Get customer orders
    const orders = await Order.find({ customerId: id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      status: 'success',
      data: {
        customer,
        recentOrders: orders
      }
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب بيانات العميل'
    });
  }
};

// Create new customer
const createCustomer = async (req, res) => {
  try {
    const { storeName, phoneNumber, password, area, availableMotors } = req.body;

    if (!storeName || !phoneNumber || !password || !area) {
      return res.status(400).json({
        status: 'error',
        message: 'جميع الحقول مطلوبة'
      });
    }

    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ phoneNumber });
    if (existingCustomer) {
      return res.status(400).json({
        status: 'error',
        message: 'العميل مسجل بالفعل'
      });
    }

    const customer = new Customer({
      storeName,
      phoneNumber,
      password,
      area,
      availableMotors: availableMotors || 1
    });

    await customer.save();

    // إرسال إشعار للإدارة بعميل جديد
    try {
      await NotificationService.notifyNewCustomer(customer._id);
    } catch (notificationError) {
      console.error('Error sending customer notification:', notificationError);
      // لا نوقف العملية إذا فشل الإشعار
    }

    res.status(201).json({
      status: 'success',
      message: 'تم إنشاء العميل بنجاح',
      data: {
        customer: {
          id: customer._id,
          storeName: customer.storeName,
          phoneNumber: customer.phoneNumber,
          area: customer.area,
          status: customer.status,
          availableMotors: customer.availableMotors,
          createdAt: customer.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Create customer error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'رقم الهاتف مسجل بالفعل'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'خطأ في إنشاء العميل'
    });
  }
};

// Update customer
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { storeName, phoneNumber, area, status, password } = req.body;

    const customer = await Customer.findById(id);
    
    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'العميل غير موجود'
      });
    }

    if (storeName) customer.storeName = storeName;
    if (phoneNumber) customer.phoneNumber = phoneNumber;
    if (area) customer.area = area;
    if (status) customer.status = status;
    
    // إذا تم إرسال كلمة مرور جديدة، قم بتحديثها
    if (password) {
      customer.password = password;
      // هذا سيطلق الـ pre-save hook لتشفير كلمة المرور
    }

    await customer.save();

    res.status(200).json({
      status: 'success',
      message: 'تم تحديث العميل بنجاح',
      data: {
        customer: {
          id: customer._id,
          storeName: customer.storeName,
          phoneNumber: customer.phoneNumber,
          area: customer.area,
          status: customer.status,
          updatedAt: customer.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تحديث العميل'
    });
  }
};

// Change customer password
const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 4) {
      return res.status(400).json({
        status: 'error',
        message: 'كلمة المرور يجب أن تكون على الأقل 4 أحرف'
      });
    }

    const customer = await Customer.findById(id);
    
    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'العميل غير موجود'
      });
    }

    // تحديث كلمة المرور (ستتم تشفيرها تلقائياً)
    customer.password = password;
    await customer.save();

    res.status(200).json({
      status: 'success',
      message: 'تم تغيير كلمة المرور بنجاح',
      data: {
        customerId: customer._id
      }
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تغيير كلمة المرور'
    });
  }
};

// Delete customer
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await Customer.findById(id);
    
    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'العميل غير موجود'
      });
    }

    // حذف جميع طلبات العميل المرتبطة به
    const deletedOrders = await Order.deleteMany({ customerId: id });
    console.log(`Deleted ${deletedOrders.deletedCount} orders for customer ${id}`);

    // حذف العميل نهائياً من قاعدة البيانات
    await Customer.findByIdAndDelete(id);

    res.status(200).json({
      status: 'success',
      message: 'تم حذف العميل وجميع طلباته نهائياً من قاعدة البيانات',
      data: {
        deletedOrdersCount: deletedOrders.deletedCount
      }
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في حذف العميل'
    });
  }
};

// Get customer statistics
const getCustomerStats = async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const activeCustomers = await Customer.countDocuments({ status: 'active' });
    const suspendedCustomers = await Customer.countDocuments({ status: 'suspended' });
    
    const customersByArea = await Customer.aggregate([
      {
        $group: {
          _id: '$area',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        totalCustomers,
        activeCustomers,
        suspendedCustomers,
        customersByArea
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب الإحصائيات'
    });
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerStats,
  changePassword
};
