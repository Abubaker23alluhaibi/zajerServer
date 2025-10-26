const Order = require('../models/Order');
const Customer = require('../models/Customer');
const SubArea = require('../models/SubArea');
const NotificationService = require('../services/notificationService');

// Create new order
const createOrder = async (req, res) => {
  try {
    const { items, deliveryAddress, subArea, notes, deliveryTime, deliveryFee = 0 } = req.body;
    const customer = req.customer;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'المنتجات مطلوبة'
      });
    }

    if (!deliveryAddress) {
      return res.status(400).json({
        status: 'error',
        message: 'عنوان التوصيل مطلوب'
      });
    }

    if (!subArea) {
      return res.status(400).json({
        status: 'error',
        message: 'المنطقة الفرعية مطلوبة'
      });
    }

    // البحث عن المنطقة الفرعية والحصول على سعرها
    // أولاً: البحث في منطقة العميل
    let subAreaData = await SubArea.findOne({ 
      name: subArea, 
      mainArea: customer.area,
      isActive: true 
    });

    // إذا لم نجد، ابحث في جميع المناطق
    if (!subAreaData) {
      subAreaData = await SubArea.findOne({ 
        name: subArea, 
        isActive: true 
      });
    }

    if (!subAreaData) {
      return res.status(400).json({
        status: 'error',
        message: 'المنطقة الفرعية غير موجودة أو غير نشطة'
      });
    }

    // Calculate total amount
    let totalAmount = 0;
    items.forEach(item => {
      totalAmount += item.price * item.quantity;
    });
    totalAmount += subAreaData.deliveryPrice; // استخدام سعر المنطقة الفرعية

    const order = new Order({
      customerId: customer._id,
      customerPhone: customer.phoneNumber,
      storeName: customer.storeName,
      items,
      totalAmount,
      deliveryFee: subAreaData.deliveryPrice, // سعر المنطقة الفرعية
      deliveryAddress,
      deliveryTime,
      subArea: subAreaData.name,
      subAreaId: subAreaData._id, // ربط مباشر بالمنطقة الفرعية
      subAreaPrice: subAreaData.deliveryPrice,
      notes,
      area: customer.area
    });

    await order.save();

    // Update customer total orders
    await Customer.findByIdAndUpdate(customer._id, {
      $inc: { totalOrders: 1 },
      lastOrderDate: new Date()
    });

    // إرسال إشعار للإدارة
    try {
      await NotificationService.notifyNewOrder(order._id);
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      // لا نوقف العملية إذا فشل الإشعار
    }

    res.status(201).json({
      status: 'success',
      message: 'تم إنشاء الطلب بنجاح',
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          items: order.items,
          totalAmount: order.totalAmount,
          deliveryFee: order.deliveryFee,
          status: order.status,
          deliveryAddress: order.deliveryAddress,
          subArea: order.subArea,
          subAreaPrice: order.subAreaPrice,
          notes: order.notes,
          area: order.area,
          createdAt: order.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في إنشاء الطلب'
    });
  }
};

// Get customer orders
const getCustomerOrders = async (req, res) => {
  try {
    const customer = req.customer;
    const { page = 1, limit = 10, status } = req.query;

    const filter = { customerId: customer._id };
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب الطلبات'
    });
  }
};

// Get order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = req.customer;

    const order = await Order.findOne({ 
      _id: id, 
      customerId: customer._id 
    });

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'الطلب غير موجود'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { order }
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب الطلب'
    });
  }
};

// Update order status (Admin only)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        status: 'error',
        message: 'حالة الطلب مطلوبة'
      });
    }

    const validStatuses = ['pending', 'accepted', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'حالة الطلب غير صحيحة'
      });
    }

    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'الطلب غير موجود'
      });
    }

    const oldStatus = order.status;
    order.status = status;
    
    if (status === 'delivered' || status === 'completed') {
      order.deliveredAt = new Date();
    }
    
    // إضافة إلى timeline للتتبع
    order.timeline.push({
      status: status,
      note: `تم تحديث الحالة من ${oldStatus} إلى ${status}`,
      updatedAt: new Date(),
      updatedBy: 'admin'
    });

    await order.save();

    // إرسال إشعار للعميل بتحديث حالة الطلب
    try {
      await NotificationService.notifyOrderStatusUpdate(order._id, status);
    } catch (notificationError) {
      console.error('Error sending status notification:', notificationError);
      // لا نوقف العملية إذا فشل الإشعار
    }

    res.status(200).json({
      status: 'success',
      message: 'تم تحديث حالة الطلب بنجاح',
      data: { order }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تحديث حالة الطلب'
    });
  }
};

// Get all orders (Admin)
const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, area, customerId } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (area) filter.area = area;
    if (customerId) filter.customerId = customerId;

    const orders = await Order.find(filter)
      .populate('customerId', 'storeName phoneNumber area')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب الطلبات'
    });
  }
};

// Get order statistics
const getOrderStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });

    const ordersByArea = await Order.aggregate([
      {
        $group: {
          _id: '$area',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const ordersByStatus = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        totalOrders,
        pendingOrders,
        deliveredOrders,
        cancelledOrders,
        ordersByArea,
        ordersByStatus
      }
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب إحصائيات الطلبات'
    });
  }
};

module.exports = {
  createOrder,
  getCustomerOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  getOrderStats
};
