const Notification = require('../models/Notification');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const PushNotificationService = require('./pushNotificationService');

class NotificationService {
  // إنشاء إشعار جديد
  static async createNotification(notificationData) {
    try {
      const notification = new Notification(notificationData);
      await notification.save();
      
      console.log(`📱 Notification created: ${notification.title}`);
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // إشعار طلب جديد للإدارة
  static async notifyNewOrder(orderId) {
    try {
      const order = await Order.findById(orderId).populate('customerId', 'storeName phoneNumber');
      
      if (!order) {
        throw new Error('Order not found');
      }

      // تحديد الأولوية حسب المبلغ
      let priority = 'normal';
      if (order.totalAmount > 500) priority = 'high';
      if (order.totalAmount > 1000) priority = 'urgent';

      const notification = await this.createNotification({
        type: 'new_order',
        title: 'طلب جديد!',
        message: `طلب جديد من ${order.storeName} - رقم الطلب: ${order.orderNumber}`,
        recipient: 'admin',
        priority: priority,
        data: {
          orderNumber: order.orderNumber,
          customerName: order.storeName,
          totalAmount: order.totalAmount,
          area: order.area
        },
        orderId: order._id,
        customerId: order.customerId._id
      });

      // Send push notification immediately
      try {
        await PushNotificationService.notifyAdminNewOrder({
          orderId: order._id,
          orderNumber: order.orderNumber,
          storeName: order.storeName,
          totalAmount: order.totalAmount,
          area: order.area
        });
      } catch (pushError) {
        console.error('Push notification error:', pushError);
        // Don't throw - continue even if push fails
      }

      return notification;
    } catch (error) {
      console.error('Error notifying new order:', error);
      throw error;
    }
  }

  // إشعار تحديث حالة الطلب للعميل
  static async notifyOrderStatusUpdate(orderId, newStatus) {
    try {
      const order = await Order.findById(orderId).populate('customerId', 'storeName phoneNumber');
      
      if (!order) {
        throw new Error('Order not found');
      }

      const statusMessages = {
        'confirmed': 'تم تأكيد طلبك',
        'preparing': 'جاري تحضير طلبك',
        'ready': 'طلبك جاهز للتوصيل',
        'delivered': 'تم توصيل طلبك بنجاح',
        'cancelled': 'تم إلغاء طلبك'
      };

      // تحديد الأولوية حسب حالة الطلب
      const priorityMap = {
        'confirmed': 'normal',
        'preparing': 'normal',
        'ready': 'high',
        'delivered': 'normal',
        'cancelled': 'high'
      };

      const notification = await this.createNotification({
        type: 'order_status_update',
        title: statusMessages[newStatus] || 'تحديث حالة الطلب',
        message: `طلب رقم ${order.orderNumber}: ${statusMessages[newStatus] || newStatus}`,
        recipient: 'customer',
        priority: priorityMap[newStatus] || 'normal',
        data: {
          orderNumber: order.orderNumber,
          status: newStatus,
          orderId: order._id
        },
        orderId: order._id,
        customerId: order.customerId._id
      });

      // Send push notification to customer
      try {
        const body = `${statusMessages[newStatus] || 'تحديث حالة الطلب'}\nرقم الطلب: ${order.orderNumber}`;
        
        await PushNotificationService.notifyCustomerById(
          order.customerId._id,
          '🔔 تحديث الطلب',
          body,
          {
            type: 'order_status_update',
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: newStatus
          }
        );
      } catch (pushError) {
        console.error('Push notification error:', pushError);
        // Don't throw - continue even if push fails
      }

      return notification;
    } catch (error) {
      console.error('Error notifying order status update:', error);
      throw error;
    }
  }

  // إشعار تسجيل عميل جديد للإدارة
  static async notifyNewCustomer(customerId) {
    try {
      const customer = await Customer.findById(customerId);
      
      if (!customer) {
        throw new Error('Customer not found');
      }

      const notification = await this.createNotification({
        type: 'customer_registered',
        title: 'عميل جديد!',
        message: `تم تسجيل عميل جديد: ${customer.storeName} - ${customer.area}`,
        recipient: 'admin',
        data: {
          customerName: customer.storeName,
          phoneNumber: customer.phoneNumber,
          area: customer.area
        },
        customerId: customer._id
      });

      return notification;
    } catch (error) {
      console.error('Error notifying new customer:', error);
      throw error;
    }
  }

  // الحصول على الإشعارات للإدارة
  static async getAdminNotifications(page = 1, limit = 20) {
    try {
      // ترتيب حسب الأولوية ثم التاريخ
      const priorityOrder = { 'urgent': 1, 'high': 2, 'normal': 3, 'low': 4 };
      
      const notifications = await Notification.find({ recipient: 'admin' })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('orderId', 'orderNumber totalAmount')
        .populate('customerId', 'storeName phoneNumber');

      // ترتيب النتائج حسب الأولوية
      notifications.sort((a, b) => {
        const priorityDiff = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      const total = await Notification.countDocuments({ recipient: 'admin' });

      return {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalNotifications: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error getting admin notifications:', error);
      throw error;
    }
  }

  // الحصول على الإشعارات للعميل
  static async getCustomerNotifications(customerId, page = 1, limit = 20) {
    try {
      const notifications = await Notification.find({ 
        $or: [
          { recipient: 'customer', customerId: customerId },
          { recipient: 'all' }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('orderId', 'orderNumber totalAmount');

      const total = await Notification.countDocuments({ 
        $or: [
          { recipient: 'customer', customerId: customerId },
          { recipient: 'all' }
        ]
      });

      return {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalNotifications: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error getting customer notifications:', error);
      throw error;
    }
  }

  // تحديد الإشعار كمقروء
  static async markAsRead(notificationId) {
    try {
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { isRead: true },
        { new: true }
      );

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // تحديد جميع الإشعارات كمقروءة
  static async markAllAsRead(recipient, customerId = null) {
    try {
      const filter = { recipient, isRead: false };
      if (customerId) {
        filter.customerId = customerId;
      }

      const result = await Notification.updateMany(filter, { isRead: true });
      return result;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // الحصول على عدد الإشعارات غير المقروءة
  static async getUnreadCount(recipient, customerId = null) {
    try {
      const filter = { recipient, isRead: false };
      if (customerId) {
        filter.customerId = customerId;
      }

      const count = await Notification.countDocuments(filter);
      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;

