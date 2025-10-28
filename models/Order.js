const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'معرف العميل مطلوب']
  },
  customerPhone: {
    type: String,
    required: [true, 'رقم هاتف العميل مطلوب']
  },
  clientPhone: {
    type: String,
    required: [true, 'رقم الزبون مطلوب'],
    trim: true
  },
  storeName: {
    type: String,
    required: [true, 'اسم المتجر مطلوب']
  },
  orderNumber: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  items: [{
    name: {
      type: String,
      required: [true, 'اسم المنتج مطلوب']
    },
    quantity: {
      type: Number,
      required: [true, 'الكمية مطلوبة'],
      min: [1, 'الكمية يجب أن تكون على الأقل 1']
    },
    price: {
      type: Number,
      required: [true, 'السعر مطلوب'],
      min: [0, 'السعر لا يمكن أن يكون سالب']
    }
  }],
  totalAmount: {
    type: Number,
    required: [true, 'المبلغ الإجمالي مطلوب'],
    min: [0, 'المبلغ الإجمالي لا يمكن أن يكون سالب']
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: [0, 'رسوم التوصيل لا يمكن أن تكون سالبة']
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'],
    default: 'pending'
  },
  deliveryAddress: {
    type: String,
    required: [true, 'عنوان التوصيل مطلوب'],
    trim: true
  },
  deliveryTime: {
    type: String,
    trim: true
  },
  subArea: {
    type: String,
    required: [true, 'المنطقة الفرعية مطلوبة'],
    trim: true
  },
  subAreaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubArea',
    required: false
  },
  subAreaPrice: {
    type: Number,
    required: [true, 'سعر المنطقة الفرعية مطلوب'],
    min: [0, 'سعر المنطقة الفرعية لا يمكن أن يكون سالب']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'الملاحظات لا يمكن أن تكون أكثر من 500 حرف']
  },
  area: {
    type: String,
    required: [true, 'المنطقة مطلوبة'],
    enum: ['الطويسة', 'الجزائر', 'الجنينة', 'التنومة', 'القبيلة', 'مناطق البصرة الاخرى']
  },
  timeline: [{
    status: {
      type: String,
      required: true
    },
    note: {
      type: String,
      trim: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'admin'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Generate order number and set timeline before saving
orderSchema.pre('save', function(next) {
  // Generate order number if not exists
  if (!this.orderNumber) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `ZJ${timestamp}${random}`;
  }
  
  // Set timeline if new order
  if (this.isNew) {
    if (!this.timeline || this.timeline.length === 0) {
      this.timeline = [{
        status: 'pending',
        note: 'تم إنشاء الطلب',
        updatedAt: new Date(),
        updatedBy: 'customer'
      }];
    }
  }
  
  next();
});

// Indexes for better performance
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ area: 1, status: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
