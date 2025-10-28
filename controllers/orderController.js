const Order = require('../models/Order');
const Customer = require('../models/Customer');
const SubArea = require('../models/SubArea');
const NotificationService = require('../services/notificationService');

// Cancel order by customer (ownership + allowed statuses)
const cancelOrderByCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = req.customer;

    const order = await Order.findOne({ _id: id, customerId: customer._id });
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: 'الطلب غير موجود'
      });
    }

    // Prevent cancelling finalized orders
    const nonCancellable = ['completed', 'cancelled'];
    if (nonCancellable.includes(order.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'لا يمكن إلغاء هذا الطلب'
      });
    }

    const oldStatus = order.status;
    order.status = 'cancelled';

    order.timeline.push({
      status: 'cancelled',
      note: `تم إلغاء الطلب من قبل العميل. الحالة السابقة: ${oldStatus}`,
      updatedAt: new Date(),
      updatedBy: 'customer'
    });

    await order.save();

    try {
      await NotificationService.notifyOrderStatusUpdate(order._id, 'cancelled');
    } catch (notificationError) {
      console.error('Error sending status notification:', notificationError);
    }

    return res.status(200).json({
      status: 'success',
      message: 'تم إلغاء الطلب بنجاح',
      data: { order }
    });
  } catch (error) {
    console.error('Cancel order by customer error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'خطأ في إلغاء الطلب'
    });
  }
};

// Create new order
const createOrder = async (req, res) => {
  try {
    const { items, deliveryAddress, subArea, notes, deliveryTime, deliveryFee: requestDeliveryFee = 0, clientPhone } = req.body;
    const customer = req.customer;
    
    // استخدام منطقة العميل المحفوظة في قاعدة البيانات
    const orderArea = customer.area;

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

    if (!clientPhone || !clientPhone.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'رقم الزبون مطلوب'
      });
    }

    if (!clientPhone.startsWith('07') || clientPhone.length !== 11) {
      return res.status(400).json({
        status: 'error',
        message: 'رقم الزبون يجب أن يبدأ بـ 07 ويتكون من 11 رقم'
      });
    }

    // البحث عن المنطقة الفرعية والحصول على سعرها
    let subAreaData = null;
    let calculatedDeliveryFee = 0;
    let subAreaPrice = 0;
    
    // إذا كانت المنطقة الرئيسية هي "مناطق البصرة الاخرى"، اقبل الطلب مباشرة
    if (orderArea === 'مناطق البصرة الاخرى') {
      // استخدام سعر التوصيل المرسل من العميل
      calculatedDeliveryFee = parseFloat(requestDeliveryFee) || 0;
      subAreaPrice = calculatedDeliveryFee;
    } else {
      // البحث في منطقة العميل
      subAreaData = await SubArea.findOne({ 
        name: subArea, 
        mainArea: orderArea,
        isActive: true 
      });

      // إذا لم نجد، ابحث في جميع المناطق
      if (!subAreaData) {
        subAreaData = await SubArea.findOne({ 
          name: subArea, 
          isActive: true 
        });
      }

      if (subAreaData) {
        calculatedDeliveryFee = subAreaData.deliveryPrice;
        subAreaPrice = subAreaData.deliveryPrice;
      } else {
        // إذا لم نجد المنطقة، اقبل الطلب مع سعر افتراضي
        calculatedDeliveryFee = parseFloat(requestDeliveryFee) || 0;
        subAreaPrice = calculatedDeliveryFee;
      }
    }

    // Calculate total amount
    let totalAmount = 0;
    items.forEach(item => {
      totalAmount += item.price * item.quantity;
    });
    totalAmount += calculatedDeliveryFee;

    const order = new Order({
      customerId: customer._id,
      customerPhone: customer.phoneNumber,
      clientPhone: clientPhone.trim(),
      storeName: customer.storeName,
      items,
      totalAmount,
      deliveryFee: calculatedDeliveryFee,
      deliveryAddress,
      deliveryTime,
      subArea: subArea,
      subAreaId: subAreaData ? subAreaData._id : null, // قد يكون null للمناطق المكتوبة
      subAreaPrice: subAreaPrice,
      notes,
      area: orderArea
    });

    await order.save();

    // Update customer total orders and send notification in parallel for better performance
    const updatePromise = Customer.findByIdAndUpdate(customer._id, {
      $inc: { totalOrders: 1 },
      lastOrderDate: new Date()
    });

    const notificationPromise = NotificationService.notifyNewOrder(order._id).catch(error => {
      console.error('Error sending notification:', error);
      // لا نوقف العملية إذا فشل الإشعار
    });

    // Execute both operations concurrently
    await Promise.all([updatePromise, notificationPromise]);

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
          customerPhone: order.customerPhone,
          clientPhone: order.clientPhone,
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
    const { page = 1, limit = 20, status } = req.query; // Increased default limit

    const filter = { customerId: customer._id };
    if (status) filter.status = status;

    // Optimize query with lean() and select specific fields
    const orders = await Order.find(filter)
      .select('orderNumber items totalAmount deliveryFee deliveryAddress deliveryTime subArea status customerPhone clientPhone createdAt')
      .lean() // Convert to plain objects for better performance
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

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
    const { page = 1, limit = 20, status, area, customerId } = req.query; // Increased default limit

    const filter = {};
    if (status) filter.status = status;
    if (area) filter.area = area;
    if (customerId) filter.customerId = customerId;

    // Optimize query with lean() and select specific fields
    const orders = await Order.find(filter)
      .populate('customerId', 'storeName phoneNumber area')
      .lean() // Convert to plain objects for better performance
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .exec();

    // Select and format only needed fields
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      items: order.items,
      totalAmount: order.totalAmount,
      deliveryFee: order.deliveryFee,
      deliveryAddress: order.deliveryAddress,
      deliveryTime: order.deliveryTime,
      subArea: order.subArea,
      subAreaPrice: order.subAreaPrice,
      status: order.status,
      area: order.area,
      storeName: order.storeName,
      customerId: order.customerId,
      customerPhone: order.customerPhone,
      clientPhone: order.clientPhone,
      notes: order.notes,
      createdAt: order.createdAt
    }));

    // Debug log to check if clientPhone is being retrieved
    console.log('🔍 First order from DB:', formattedOrders[0] ? JSON.stringify({
      _id: formattedOrders[0]._id,
      customerPhone: formattedOrders[0].customerPhone,
      clientPhone: formattedOrders[0].clientPhone,
      storeName: formattedOrders[0].storeName
    }, null, 2) : 'No orders');

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        orders: formattedOrders,
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
  getOrderStats,
  cancelOrderByCustomer
};
