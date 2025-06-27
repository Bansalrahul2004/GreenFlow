const express = require('express');
const { body, validationResult } = require('express-validator');
const Shipment = require('../models/Shipment');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const { authenticateToken, isAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/shipments
// @desc    Get all shipments with filtering
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      supplierId, 
      productId, 
      status, 
      transportMode,
      startDate,
      endDate,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (supplierId) query.supplierId = supplierId;
    if (productId) query.productId = productId;
    if (status) query.status = status;
    if (transportMode) query.transportMode = transportMode;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Role-based filtering
    if (req.user.role === 'supplier') {
      query.supplierId = req.user.supplierId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const shipments = await Shipment.find(query)
      .populate('supplierId', 'name ESGscore')
      .populate('productId', 'name category price')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sortOptions);

    const total = await Shipment.countDocuments(query);

    res.json({
      shipments,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get shipments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/shipments/:id
// @desc    Get shipment by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id)
      .populate('supplierId', 'name ESGscore certificationLevel')
      .populate('productId', 'name category price sustainabilityMetrics');

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json({ shipment });
  } catch (error) {
    console.error('Get shipment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/shipments
// @desc    Create new shipment
// @access  Private
router.post('/', [
  authenticateToken,
  body('supplierId').isMongoId(),
  body('productId').isMongoId(),
  body('quantity').isFloat({ min: 1 }),
  body('distanceKm').isFloat({ min: 0 }),
  body('transportMode').isIn(['diesel', 'electric', 'hybrid', 'rail', 'ship', 'air']),
  body('vehicleType').optional().isIn(['truck', 'van', 'car', 'train', 'ship', 'plane']),
  body('origin').optional(),
  body('destination').optional(),
  body('packagingWeight').optional().isFloat({ min: 0 }),
  body('estimatedDelivery').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      supplierId,
      productId,
      quantity,
      distanceKm,
      transportMode,
      vehicleType,
      origin,
      destination,
      packagingWeight = 0,
      estimatedDelivery,
      notes
    } = req.body;

    // Verify supplier and product exist
    const [supplier, product] = await Promise.all([
      Supplier.findById(supplierId),
      Product.findById(productId)
    ]);

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Role-based validation
    if (req.user.role === 'supplier' && req.user.supplierId?.toString() !== supplierId) {
      return res.status(403).json({ error: 'Can only create shipments for your own supplier account' });
    }

    console.log('Creating shipment with data:', {
      supplierId,
      productId,
      quantity,
      distanceKm,
      transportMode,
      vehicleType: vehicleType || (transportMode === 'rail' ? 'train' : 
                                  transportMode === 'ship' ? 'ship' : 
                                  transportMode === 'air' ? 'plane' : 'truck'),
      packagingWeight,
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined
    });

    // Create shipment object
    const shipment = new Shipment({
      supplierId,
      productId,
      quantity,
      distanceKm,
      transportMode,
      vehicleType: vehicleType || (transportMode === 'rail' ? 'train' : 
                                  transportMode === 'ship' ? 'ship' : 
                                  transportMode === 'air' ? 'plane' : 'truck'),
      origin,
      destination,
      packagingWeight,
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
      notes
    });

    console.log('Shipment object created:', shipment);

    // Carbon footprint is calculated automatically as a virtual field
    await shipment.save();

    // Populate references for response
    await shipment.populate('supplierId', 'name ESGscore');
    await shipment.populate('productId', 'name category');

    res.status(201).json({ shipment });
  } catch (error) {
    console.error('Create shipment error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({ 
        error: 'Validation error', 
        details: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }
    
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/shipments/:id
// @desc    Update shipment
// @access  Private
router.put('/:id', [
  authenticateToken,
  body('quantity').optional().isFloat({ min: 1 }),
  body('distanceKm').optional().isFloat({ min: 0 }),
  body('transportMode').optional().isIn(['diesel', 'electric', 'hybrid', 'rail', 'ship', 'air']),
  body('vehicleType').optional().isIn(['truck', 'van', 'car', 'train', 'ship', 'plane']),
  body('status').optional().isIn(['pending', 'in-transit', 'delivered', 'cancelled']),
  body('estimatedDelivery').optional().isISO8601(),
  body('actualDelivery').optional().isISO8601(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    // Role-based validation
    if (req.user.role === 'supplier' && req.user.supplierId?.toString() !== shipment.supplierId.toString()) {
      return res.status(403).json({ error: 'Can only update shipments for your own supplier account' });
    }

    const updateData = { ...req.body };
    
    // Convert date strings to Date objects
    if (updateData.estimatedDelivery) {
      updateData.estimatedDelivery = new Date(updateData.estimatedDelivery);
    }
    if (updateData.actualDelivery) {
      updateData.actualDelivery = new Date(updateData.actualDelivery);
    }

    // Remove fields that shouldn't be updated
    delete updateData.supplierId;
    delete updateData.productId;
    delete updateData.carbonKg; // This is calculated automatically

    const updatedShipment = await Shipment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('supplierId', 'name ESGscore')
     .populate('productId', 'name category');

    res.json({ shipment: updatedShipment });
  } catch (error) {
    console.error('Update shipment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/shipments/analytics/carbon
// @desc    Get carbon footprint analytics
// @access  Private
router.get('/analytics/carbon', authenticateToken, async (req, res) => {
  try {
    const { period = '30d', supplierId, transportMode } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const query = {
      timestamp: { $gte: startDate }
    };

    if (supplierId) query.supplierId = supplierId;
    if (transportMode) query.transportMode = transportMode;

    // Role-based filtering
    if (req.user.role === 'supplier') {
      query.supplierId = req.user.supplierId;
    }

    const shipments = await Shipment.find(query)
      .populate('supplierId', 'name')
      .populate('productId', 'name category');

    // Calculate analytics
    const totalCarbon = shipments.reduce((sum, shipment) => sum + shipment.carbonKg, 0);
    const totalShipments = shipments.length;
    const avgCarbonPerShipment = totalShipments > 0 ? totalCarbon / totalShipments : 0;

    // Group by transport mode
    const carbonByTransport = shipments.reduce((acc, shipment) => {
      const mode = shipment.transportMode;
      if (!acc[mode]) {
        acc[mode] = { total: 0, count: 0, avg: 0 };
      }
      acc[mode].total += shipment.carbonKg;
      acc[mode].count += 1;
      return acc;
    }, {});

    // Calculate averages
    Object.keys(carbonByTransport).forEach(mode => {
      carbonByTransport[mode].avg = carbonByTransport[mode].total / carbonByTransport[mode].count;
    });

    // Group by supplier
    const carbonBySupplier = shipments.reduce((acc, shipment) => {
      const supplierName = shipment.supplierId?.name || 'Unknown';
      if (!acc[supplierName]) {
        acc[supplierName] = { total: 0, count: 0, avg: 0 };
      }
      acc[supplierName].total += shipment.carbonKg;
      acc[supplierName].count += 1;
      return acc;
    }, {});

    // Calculate averages
    Object.keys(carbonBySupplier).forEach(supplier => {
      carbonBySupplier[supplier].avg = carbonBySupplier[supplier].total / carbonBySupplier[supplier].count;
    });

    // Daily carbon emissions for chart
    const dailyCarbon = {};
    shipments.forEach(shipment => {
      const date = shipment.timestamp.toISOString().split('T')[0];
      dailyCarbon[date] = (dailyCarbon[date] || 0) + shipment.carbonKg;
    });

    const analytics = {
      summary: {
        totalCarbon: Math.round(totalCarbon * 100) / 100,
        totalShipments,
        avgCarbonPerShipment: Math.round(avgCarbonPerShipment * 100) / 100
      },
      carbonByTransport,
      carbonBySupplier,
      dailyCarbon: Object.entries(dailyCarbon).map(([date, carbon]) => ({
        date,
        carbon: Math.round(carbon * 100) / 100
      })).sort((a, b) => new Date(a.date) - new Date(b.date)),
      period,
      startDate,
      endDate: now
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get carbon analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/shipments/analytics/efficiency
// @desc    Get transport efficiency analytics
// @access  Private
router.get('/analytics/efficiency', authenticateToken, async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const query = { timestamp: { $gte: startDate } };

    // Role-based filtering
    if (req.user.role === 'supplier') {
      query.supplierId = req.user.supplierId;
    }

    const shipments = await Shipment.find(query);

    // Calculate efficiency metrics
    const efficiencyData = shipments.map(shipment => ({
      id: shipment._id,
      carbonPerUnit: shipment.carbonKg / shipment.quantity,
      carbonPerKm: shipment.carbonKg / shipment.distanceKm,
      transportMode: shipment.transportMode,
      vehicleType: shipment.vehicleType,
      distance: shipment.distanceKm,
      quantity: shipment.quantity
    }));

    // Group by transport mode
    const efficiencyByMode = efficiencyData.reduce((acc, item) => {
      if (!acc[item.transportMode]) {
        acc[item.transportMode] = [];
      }
      acc[item.transportMode].push(item);
      return acc;
    }, {});

    // Calculate averages for each mode
    const modeAverages = {};
    Object.keys(efficiencyByMode).forEach(mode => {
      const items = efficiencyByMode[mode];
      const avgCarbonPerUnit = items.reduce((sum, item) => sum + item.carbonPerUnit, 0) / items.length;
      const avgCarbonPerKm = items.reduce((sum, item) => sum + item.carbonPerKm, 0) / items.length;
      
      modeAverages[mode] = {
        avgCarbonPerUnit: Math.round(avgCarbonPerUnit * 1000) / 1000,
        avgCarbonPerKm: Math.round(avgCarbonPerKm * 1000) / 1000,
        count: items.length
      };
    });

    // Find most efficient shipments
    const mostEfficient = efficiencyData
      .sort((a, b) => a.carbonPerUnit - b.carbonPerUnit)
      .slice(0, 10);

    const analytics = {
      modeAverages,
      mostEfficient,
      totalShipments: shipments.length,
      period,
      startDate,
      endDate: now
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get efficiency analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 