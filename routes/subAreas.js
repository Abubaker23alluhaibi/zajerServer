const express = require('express');
const router = express.Router();
const SubArea = require('../models/SubArea');

// Get sub areas by main area
router.get('/by-main-area/:mainArea', async (req, res) => {
  try {
    const { mainArea } = req.params;
    
    const subAreas = await SubArea.find({ 
      mainArea: mainArea,
      isActive: true 
    }).sort({ deliveryPrice: 1, name: 1 });

    res.status(200).json({
      status: 'success',
      data: {
        mainArea,
        subAreas: subAreas.map(area => ({
          id: area._id,
          name: area.name,
          deliveryPrice: area.deliveryPrice
        }))
      }
    });
  } catch (error) {
    console.error('Get sub areas error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب المناطق الفرعية'
    });
  }
});

// Get all sub areas
router.get('/', async (req, res) => {
  try {
    console.log('📡 GET /api/sub-areas - Request received');
    
    const { mainArea, isActive = true } = req.query;
    
    const filter = {};
    if (mainArea) filter.mainArea = mainArea;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    console.log('🔍 Filter:', filter);
    const subAreas = await SubArea.find(filter)
      .sort({ mainArea: 1, deliveryPrice: 1, name: 1 });

    console.log(`✅ Found ${subAreas.length} sub areas in database`);

    // Group by main area
    const groupedAreas = subAreas.reduce((acc, area) => {
      if (!acc[area.mainArea]) {
        acc[area.mainArea] = [];
      }
      acc[area.mainArea].push({
        id: area._id,
        name: area.name,
        deliveryPrice: area.deliveryPrice,
        isActive: area.isActive
      });
      return acc;
    }, {});

    console.log('📊 Grouped by main areas:', Object.keys(groupedAreas));

    res.status(200).json({
      status: 'success',
      data: {
        subAreas: groupedAreas,
        total: subAreas.length
      }
    });
  } catch (error) {
    console.error('❌ Get all sub areas error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب المناطق الفرعية'
    });
  }
});

// Get sub area by name and main area
router.get('/find', async (req, res) => {
  try {
    const { name, mainArea } = req.query;
    
    if (!name || !mainArea) {
      return res.status(400).json({
        status: 'error',
        message: 'اسم المنطقة الفرعية والمنطقة الرئيسية مطلوبان'
      });
    }

    const subArea = await SubArea.findOne({ 
      name: name,
      mainArea: mainArea,
      isActive: true 
    });

    if (!subArea) {
      return res.status(404).json({
        status: 'error',
        message: 'المنطقة الفرعية غير موجودة'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        subArea: {
          id: subArea._id,
          name: subArea.name,
          mainArea: subArea.mainArea,
          deliveryPrice: subArea.deliveryPrice
        }
      }
    });
  } catch (error) {
    console.error('Find sub area error:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في البحث عن المنطقة الفرعية'
    });
  }
});

module.exports = router;

