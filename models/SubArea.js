const mongoose = require('mongoose');

const subAreaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم المنطقة الفرعية مطلوب'],
    trim: true
  },
  mainArea: {
    type: String,
    required: [true, 'المنطقة الرئيسية مطلوبة'],
    enum: ['الطويسة', 'الجزائر', 'الجبيلة', 'الجنينة', 'التنومة', 'مناطق البصرة الاخرى']
  },
  deliveryPrice: {
    type: Number,
    required: [true, 'سعر التوصيل مطلوب'],
    min: [0, 'سعر التوصيل لا يمكن أن يكون سالب']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better performance
subAreaSchema.index({ mainArea: 1, name: 1 });
subAreaSchema.index({ mainArea: 1, isActive: 1 });

module.exports = mongoose.model('SubArea', subAreaSchema);

