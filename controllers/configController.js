const fs = require('fs');
const path = require('path');
const Admin = require('../models/Admin');

const CONFIG_FILE = path.join(__dirname, '../config.env');

// Get admin config
const getAdminConfig = async (req, res) => {
  try {
    // Get admin from database
    const admins = await Admin.find({ isActive: true }).select('adminId name role createdAt lastLogin');
    
    res.status(200).json({
      status: 'success',
      data: {
        admins: admins.length > 0 ? admins : []
      }
    });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب الإعدادات'
    });
  }
};

// Create new admin
const createAdmin = async (req, res) => {
  try {
    const { adminId, secretCode, name, role } = req.body;

    if (!adminId || !secretCode) {
      return res.status(400).json({
        status: 'error',
        message: 'معرف الإدارة والرمز السري مطلوبان'
      });
    }

    if (adminId.trim().length < 3) {
      return res.status(400).json({
        status: 'error',
        message: 'معرف الإدارة يجب أن يكون 3 أحرف على الأقل'
      });
    }

    if (secretCode.trim().length < 4) {
      return res.status(400).json({
        status: 'error',
        message: 'الرمز السري يجب أن يكون 4 أحرف على الأقل'
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ adminId: adminId.trim() });
    if (existingAdmin) {
      return res.status(400).json({
        status: 'error',
        message: 'معرف الإدارة موجود بالفعل'
      });
    }

    const admin = new Admin({
      adminId: adminId.trim(),
      secretCode: secretCode.trim(),
      name: name || `مدير ${adminId}`,
      role: role || 'admin',
      isActive: true
    });

    await admin.save();

    console.log('✅ New admin created:', adminId);

    res.status(201).json({
      status: 'success',
      message: 'تم إنشاء حساب الإدارة بنجاح',
      data: {
        admin: {
          adminId: admin.adminId,
          name: admin.name,
          role: admin.role
        }
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في إنشاء حساب الإدارة'
    });
  }
};

// Update admin config
const updateAdminConfig = async (req, res) => {
  try {
    const { adminId, newAdminId, newSecretCode, name, isActive } = req.body;

    if (!adminId) {
      return res.status(400).json({
        status: 'error',
        message: 'معرف الإدارة مطلوب'
      });
    }

    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(404).json({
        status: 'error',
        message: 'حساب الإدارة غير موجود'
      });
    }

    // Update fields
    if (newAdminId && newAdminId.trim() !== admin.adminId) {
      const existing = await Admin.findOne({ adminId: newAdminId.trim() });
      if (existing && existing._id.toString() !== admin._id.toString()) {
        return res.status(400).json({
          status: 'error',
          message: 'معرف الإدارة الجديد موجود بالفعل'
        });
      }
      admin.adminId = newAdminId.trim();
    }

    if (newSecretCode && newSecretCode.trim()) {
      // Direct assignment - the pre-save hook will hash it
      admin.secretCode = newSecretCode.trim();
      admin.markModified('secretCode');
    }

    if (name) {
      admin.name = name.trim();
    }

    if (typeof isActive === 'boolean') {
      admin.isActive = isActive;
    }

    admin.updatedAt = new Date();
    await admin.save();

    console.log('✅ Admin updated:', admin.adminId);

    res.status(200).json({
      status: 'success',
      message: 'تم تحديث إعدادات الإدارة بنجاح',
      data: {
        admin: {
          adminId: admin.adminId,
          name: admin.name,
          role: admin.role,
          isActive: admin.isActive
        }
      }
    });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تحديث الإعدادات'
    });
  }
};

module.exports = {
  getAdminConfig,
  updateAdminConfig,
  createAdmin
};

