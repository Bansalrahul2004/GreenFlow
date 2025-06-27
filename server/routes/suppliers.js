const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Supplier = require('../models/Supplier');
const User = require('../models/User');
const { authenticateToken, isAdmin, isSupplier, canAccessSupplier, isAdminOrManager } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and document files are allowed'));
    }
  }
});

// @route   GET /api/suppliers
// @desc    Get all suppliers with filtering
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      certificationLevel, 
      status, 
      search,
      minESGscore,
      sortBy = 'ESGscore',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (certificationLevel) query.certificationLevel = certificationLevel;
    if (status) query.status = status;
    if (minESGscore) query.ESGscore = { $gte: parseInt(minESGscore) };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } }
      ];
    }

    // Role-based filtering
    if (req.user.role === 'supplier') {
      query._id = req.user.supplierId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const suppliers = await Supplier.find(query)
      .populate('products', 'name category sustainabilityMetrics.greenScore')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sortOptions);

    const total = await Supplier.countDocuments(query);

    res.json({
      suppliers,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/suppliers/:id
// @desc    Get supplier by ID
// @access  Private
router.get('/:id', [authenticateToken, canAccessSupplier], async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
      .populate('products', 'name category price sustainabilityMetrics inventory');

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({ supplier });
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/suppliers
// @desc    Create new supplier
// @access  Private/AdminOrManager
router.post('/', [
  authenticateToken,
  isAdminOrManager,
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('certificationLevel').isIn(['None', 'Basic', 'FairTrade', 'Organic', 'B Corp', 'Carbon Neutral']),
  body('address.street').optional().trim(),
  body('address.city').optional().trim(),
  body('address.state').optional().trim(),
  body('address.country').optional().trim(),
  body('address.zipCode').optional().trim(),
  body('ESGscore').optional().isFloat({ min: 0, max: 100 }),
  body('esgScore').optional().isFloat({ min: 0, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      email,
      phone,
      certificationLevel,
      address,
      sustainabilityMetrics
    } = req.body;

    // Accept both ESGscore and esgScore from the request body
    const ESGscore = req.body.ESGscore !== undefined ? req.body.ESGscore : req.body.esgScore;

    // Check if supplier already exists
    const existingSupplier = await Supplier.findOne({ email });
    if (existingSupplier) {
      return res.status(400).json({ error: 'Supplier already exists' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const supplierData = {
      name,
      email,
      phone,
      certificationLevel,
      address,
      sustainabilityMetrics,
      ESGscore: ESGscore,
    };

    const supplier = new Supplier(supplierData);

    // Calculate ESG score
    supplier.ESGscore = supplier.calculateESGScore();
    await supplier.save();

    // Generate a random password
    const tempPassword = crypto.randomBytes(8).toString('base64');

    // Create supplier user
    const user = new User({
      name,
      email,
      password: tempPassword,
      role: 'supplier',
      supplierId: supplier._id,
      mustChangePassword: true
    });
    await user.save();

    res.status(201).json({ supplier, tempPassword });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/suppliers/:id
// @desc    Update supplier
// @access  Private
router.put('/:id', [
  authenticateToken,
  canAccessSupplier,
  body('name').optional().trim().isLength({ min: 2 }),
  body('phone').optional().trim(),
  body('certificationLevel').optional().isIn(['None', 'Basic', 'FairTrade', 'Organic', 'B Corp', 'Carbon Neutral']),
  body('address').optional(),
  body('sustainabilityMetrics').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = { ...req.body };
    
    // Remove fields that shouldn't be updated directly
    delete updateData.email;
    delete updateData.status;
    delete updateData.ESGscore;

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Recalculate ESG score
    supplier.ESGscore = supplier.calculateESGScore();
    await supplier.save();

    res.json({ supplier });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/suppliers/:id/documents
// @desc    Upload supplier documents
// @access  Private
router.post('/:id/documents', [
  authenticateToken,
  canAccessSupplier,
  upload.array('documents', 5)
], async (req, res) => {
  try {
    const { id } = req.params;
    const { documentType } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const newDocs = req.files.map(file => ({
      name: file.originalname,
      url: `/uploads/${file.filename}`,
      type: documentType || 'certification',
      uploadedAt: new Date()
    }));

    supplier.auditDocs.push(...newDocs);
    
    // Recalculate ESG score
    supplier.ESGscore = supplier.calculateESGScore();
    
    await supplier.save();

    res.json({ 
      message: 'Documents uploaded successfully',
      documents: newDocs,
      newESGscore: supplier.ESGscore
    });
  } catch (error) {
    console.error('Upload documents error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/suppliers/:id/analytics
// @desc    Get supplier analytics
// @access  Private
router.get('/:id/analytics', [authenticateToken, canAccessSupplier], async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30d' } = req.query;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

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

    // Get shipments for this supplier
    const Shipment = require('../models/Shipment');
    const shipments = await Shipment.find({
      supplierId: id,
      timestamp: { $gte: startDate }
    }).populate('productId', 'name category');

    // Calculate analytics
    const totalShipments = shipments.length;
    const totalCarbon = shipments.reduce((sum, shipment) => sum + shipment.carbonKg, 0);
    const avgCarbonPerShipment = totalShipments > 0 ? totalCarbon / totalShipments : 0;
    
    const transportModes = shipments.reduce((acc, shipment) => {
      acc[shipment.transportMode] = (acc[shipment.transportMode] || 0) + 1;
      return acc;
    }, {});

    const analytics = {
      supplier: {
        name: supplier.name,
        ESGscore: supplier.ESGscore,
        certificationLevel: supplier.certificationLevel,
        status: supplier.status
      },
      shipments: {
        total: totalShipments,
        totalCarbon,
        avgCarbonPerShipment: Math.round(avgCarbonPerShipment * 100) / 100,
        transportModes
      },
      sustainability: {
        carbonFootprint: supplier.sustainabilityMetrics.carbonFootprint,
        wasteReduction: supplier.sustainabilityMetrics.wasteReduction,
        renewableEnergy: supplier.sustainabilityMetrics.renewableEnergy
      },
      period,
      startDate,
      endDate: now
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get supplier analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 