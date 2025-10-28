const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  adminId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  secretCode: {
    type: String,
    required: true,
    trim: true,
    minlength: 4
  },
  name: {
    type: String,
    default: 'مدير النظام'
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'manager'],
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  pushToken: {
    type: String,
    default: null
  },
  lastLogin: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash secret code before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('secretCode')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.secretCode = await bcrypt.hash(this.secretCode, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare secret code
adminSchema.methods.compareSecretCode = async function(candidateCode) {
  try {
    return await bcrypt.compare(candidateCode, this.secretCode);
  } catch (error) {
    return false;
  }
};

// Method to get admin without sensitive data
adminSchema.methods.toJSON = function() {
  const admin = this.toObject();
  delete admin.secretCode;
  return admin;
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;

