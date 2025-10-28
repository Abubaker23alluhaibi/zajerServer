const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const customerSchema = new mongoose.Schema({
  storeName: {
    type: String,
    required: [true, 'اسم المتجر مطلوب'],
    trim: true,
    maxlength: [100, 'اسم المتجر لا يمكن أن يكون أكثر من 100 حرف']
  },
  phoneNumber: {
    type: String,
    required: [true, 'رقم الهاتف مطلوب'],
    unique: true,
    trim: true,
    match: [/^[0-9]{10,15}$/, 'رقم الهاتف غير صحيح']
  },
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [4, 'كلمة المرور يجب أن تكون على الأقل 4 أحرف']
  },
  area: {
    type: String,
    required: [true, 'المنطقة مطلوبة'],
    enum: ['الطويسة', 'الجزائر', 'الجبيلة', 'الجنينة', 'التنومة', 'مناطق البصرة الاخرى'],
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'inactive'],
    default: 'active'
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  lastOrderDate: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'الملاحظات لا يمكن أن تكون أكثر من 500 حرف']
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  availableMotors: {
    type: Number,
    default: 1,
    min: [1, 'عدد الماطورات يجب أن يكون على الأقل 1']
  }
}, {
  timestamps: true
});

// Hash password before saving
customerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
customerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update updatedAt before saving
customerSchema.pre('save', function(next) {
  if (!this.isModified('password')) {
    this.updatedAt = Date.now();
  }
  next();
});

// Indexes for better performance
customerSchema.index({ phoneNumber: 1 });
customerSchema.index({ area: 1, status: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Customer', customerSchema);
