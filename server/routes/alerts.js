const express = require('express');
const { body, validationResult } = require('express-validator');
const WasteAlert = require('../models/WasteAlert');
const Product = require('../models/Product');
const { authenticateToken, isAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/alerts
// @desc    Get all waste alerts with filtering
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      riskLevel, 
      status, 
      productId,
      supplierId,
      region,
      sortBy = 'alertDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (riskLevel) query.riskLevel = riskLevel;
    if (status) query.status = status;
    if (productId) query.productId = productId;
    if (supplierId) query.supplierId = supplierId;
    if (region) query.region = region;

    // Role-based filtering
    if (req.user.role === 'supplier') {
      query.supplierId = req.user.supplierId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const alerts = await WasteAlert.find(query)
      .populate('productId', 'name category price sustainabilityMetrics.greenScore')
      .populate('supplierId', 'name ESGscore')
      .populate('acknowledgedBy', 'name')
      .populate('resolvedBy', 'name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sortOptions);

    const total = await WasteAlert.countDocuments(query);

    res.json({
      alerts,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/alerts/:id
// @desc    Get alert by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const alert = await WasteAlert.findById(req.params.id)
      .populate('productId', 'name category price sustainabilityMetrics inventory')
      .populate('supplierId', 'name ESGscore certificationLevel')
      .populate('acknowledgedBy', 'name email')
      .populate('resolvedBy', 'name email');

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ alert });
  } catch (error) {
    console.error('Get alert error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/alerts
// @desc    Create new waste alert
// @access  Private
router.post('/', [
  authenticateToken,
  body('productId').isMongoId(),
  body('supplierId').isMongoId(),
  body('region').trim().isLength({ min: 2 }),
  body('predictedWasteQty').isFloat({ min: 0 }),
  body('currentStock').isFloat({ min: 0 }),
  body('predictedWastePercentage').isFloat({ min: 0, max: 100 }),
  body('predictedDate').isISO8601(),
  body('confidence').optional().isFloat({ min: 0, max: 100 }),
  body('factors').optional().isArray(),
  body('recommendations').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      productId,
      supplierId,
      region,
      storeId,
      predictedWasteQty,
      currentStock,
      predictedWastePercentage,
      predictedDate,
      confidence = 75,
      factors = [],
      recommendations = []
    } = req.body;

    // Verify product and supplier exist
    const [product, supplier] = await Promise.all([
      Product.findById(productId),
      require('../models/Supplier').findById(supplierId)
    ]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Role-based validation
    if (req.user.role === 'supplier' && req.user.supplierId?.toString() !== supplierId) {
      return res.status(403).json({ error: 'Can only create alerts for your own supplier account' });
    }

    const alert = new WasteAlert({
      productId,
      supplierId,
      region,
      storeId,
      predictedWasteQty,
      currentStock,
      predictedWastePercentage,
      predictedDate: new Date(predictedDate),
      confidence,
      factors,
      recommendations
    });

    // Risk level and recommendations are calculated automatically in the model
    await alert.save();

    // Populate references for response
    await alert.populate('productId', 'name category');
    await alert.populate('supplierId', 'name ESGscore');

    res.status(201).json({ alert });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/alerts/:id/acknowledge
// @desc    Acknowledge waste alert
// @access  Private
router.put('/:id/acknowledge', [
  authenticateToken,
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { notes } = req.body;

    const alert = await WasteAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Role-based validation
    if (req.user.role === 'supplier' && req.user.supplierId?.toString() !== alert.supplierId.toString()) {
      return res.status(403).json({ error: 'Can only acknowledge alerts for your own supplier account' });
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = req.user._id;
    alert.acknowledgedAt = new Date();
    if (notes) alert.resolutionNotes = notes;

    await alert.save();

    await alert.populate('acknowledgedBy', 'name email');

    res.json({ alert });
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/alerts/:id/resolve
// @desc    Resolve waste alert
// @access  Private
router.put('/:id/resolve', [
  authenticateToken,
  body('actualWasteQty').optional().isFloat({ min: 0 }),
  body('resolutionNotes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { actualWasteQty, resolutionNotes } = req.body;

    const alert = await WasteAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Role-based validation
    if (req.user.role === 'supplier' && req.user.supplierId?.toString() !== alert.supplierId.toString()) {
      return res.status(403).json({ error: 'Can only resolve alerts for your own supplier account' });
    }

    alert.status = 'resolved';
    alert.resolvedBy = req.user._id;
    alert.resolvedAt = new Date();
    if (actualWasteQty !== undefined) alert.actualWasteQty = actualWasteQty;
    if (resolutionNotes) alert.resolutionNotes = resolutionNotes;

    // Calculate accuracy if actual waste is provided
    if (actualWasteQty !== undefined && alert.predictedWasteQty > 0) {
      const accuracy = Math.max(0, 100 - Math.abs((actualWasteQty - alert.predictedWasteQty) / alert.predictedWasteQty * 100));
      alert.accuracy = Math.round(accuracy * 100) / 100;
    }

    await alert.save();

    await alert.populate('resolvedBy', 'name email');

    res.json({ alert });
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/alerts/:id/dismiss
// @desc    Dismiss waste alert
// @access  Private
router.put('/:id/dismiss', [
  authenticateToken,
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { notes } = req.body;

    const alert = await WasteAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Role-based validation
    if (req.user.role === 'supplier' && req.user.supplierId?.toString() !== alert.supplierId.toString()) {
      return res.status(403).json({ error: 'Can only dismiss alerts for your own supplier account' });
    }

    alert.status = 'dismissed';
    alert.resolvedBy = req.user._id;
    alert.resolvedAt = new Date();
    if (notes) alert.resolutionNotes = notes;

    await alert.save();

    await alert.populate('resolvedBy', 'name email');

    res.json({ alert });
  } catch (error) {
    console.error('Dismiss alert error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/alerts/analytics/summary
// @desc    Get alerts summary analytics
// @access  Private
router.get('/analytics/summary', authenticateToken, async (req, res) => {
  try {
    const { period = '30d', supplierId } = req.query;

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

    const query = { alertDate: { $gte: startDate } };
    if (supplierId) query.supplierId = supplierId;

    // Role-based filtering
    if (req.user.role === 'supplier') {
      query.supplierId = req.user.supplierId;
    }

    const alerts = await WasteAlert.find(query)
      .populate('productId', 'name category price')
      .populate('supplierId', 'name');

    // Calculate analytics
    const totalAlerts = alerts.length;
    const activeAlerts = alerts.filter(alert => alert.status === 'active').length;
    const resolvedAlerts = alerts.filter(alert => alert.status === 'resolved').length;
    const dismissedAlerts = alerts.filter(alert => alert.status === 'dismissed').length;

    // Group by risk level
    const alertsByRisk = alerts.reduce((acc, alert) => {
      acc[alert.riskLevel] = (acc[alert.riskLevel] || 0) + 1;
      return acc;
    }, {});

    // Group by status
    const alertsByStatus = alerts.reduce((acc, alert) => {
      acc[alert.status] = (acc[alert.status] || 0) + 1;
      return acc;
    }, {});

    // Calculate total potential savings
    const totalPotentialSavings = alerts.reduce((sum, alert) => {
      return sum + (alert.potentialSavings || 0);
    }, 0);

    // Calculate average accuracy for resolved alerts
    const resolvedWithAccuracy = alerts.filter(alert => alert.accuracy !== undefined);
    const avgAccuracy = resolvedWithAccuracy.length > 0 
      ? resolvedWithAccuracy.reduce((sum, alert) => sum + alert.accuracy, 0) / resolvedWithAccuracy.length 
      : 0;

    // Daily alerts for chart
    const dailyAlerts = {};
    alerts.forEach(alert => {
      const date = alert.alertDate.toISOString().split('T')[0];
      dailyAlerts[date] = (dailyAlerts[date] || 0) + 1;
    });

    const analytics = {
      summary: {
        totalAlerts,
        activeAlerts,
        resolvedAlerts,
        dismissedAlerts,
        totalPotentialSavings: Math.round(totalPotentialSavings * 100) / 100,
        avgAccuracy: Math.round(avgAccuracy * 100) / 100
      },
      alertsByRisk,
      alertsByStatus,
      dailyAlerts: Object.entries(dailyAlerts).map(([date, count]) => ({
        date,
        count
      })).sort((a, b) => new Date(a.date) - new Date(b.date)),
      period,
      startDate,
      endDate: now
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get alerts analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/alerts/analytics/accuracy
// @desc    Get prediction accuracy analytics
// @access  Private
router.get('/analytics/accuracy', authenticateToken, async (req, res) => {
  try {
    const { period = '30d', supplierId } = req.query;

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
      alertDate: { $gte: startDate },
      accuracy: { $exists: true, $ne: null }
    };
    if (supplierId) query.supplierId = supplierId;

    // Role-based filtering
    if (req.user.role === 'supplier') {
      query.supplierId = req.user.supplierId;
    }

    const alerts = await WasteAlert.find(query)
      .populate('productId', 'name category')
      .populate('supplierId', 'name');

    // Calculate accuracy metrics
    const totalResolved = alerts.length;
    const avgAccuracy = totalResolved > 0 
      ? alerts.reduce((sum, alert) => sum + alert.accuracy, 0) / totalResolved 
      : 0;

    // Group by risk level
    const accuracyByRisk = alerts.reduce((acc, alert) => {
      if (!acc[alert.riskLevel]) {
        acc[alert.riskLevel] = { alerts: [], avgAccuracy: 0, count: 0 };
      }
      acc[alert.riskLevel].alerts.push(alert);
      acc[alert.riskLevel].count += 1;
      return acc;
    }, {});

    // Calculate averages for each risk level
    Object.keys(accuracyByRisk).forEach(riskLevel => {
      const riskAlerts = accuracyByRisk[riskLevel].alerts;
      const avgAccuracy = riskAlerts.reduce((sum, alert) => sum + alert.accuracy, 0) / riskAlerts.length;
      accuracyByRisk[riskLevel].avgAccuracy = Math.round(avgAccuracy * 100) / 100;
    });

    // Group by product category
    const accuracyByCategory = alerts.reduce((acc, alert) => {
      const category = alert.productId?.category || 'Unknown';
      if (!acc[category]) {
        acc[category] = { alerts: [], avgAccuracy: 0, count: 0 };
      }
      acc[category].alerts.push(alert);
      acc[category].count += 1;
      return acc;
    }, {});

    // Calculate averages for each category
    Object.keys(accuracyByCategory).forEach(category => {
      const categoryAlerts = accuracyByCategory[category].alerts;
      const avgAccuracy = categoryAlerts.reduce((sum, alert) => sum + alert.accuracy, 0) / categoryAlerts.length;
      accuracyByCategory[category].avgAccuracy = Math.round(avgAccuracy * 100) / 100;
    });

    const analytics = {
      summary: {
        totalResolved,
        avgAccuracy: Math.round(avgAccuracy * 100) / 100
      },
      accuracyByRisk,
      accuracyByCategory,
      period,
      startDate,
      endDate: now
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get accuracy analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 