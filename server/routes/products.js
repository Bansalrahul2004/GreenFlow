const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const { authenticateToken, isAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/products
// @desc    Get all products with filtering
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      supplierId, 
      packagingType,
      minGreenScore,
      search,
      sortBy = 'sustainabilityMetrics.greenScore',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };
    
    if (category) query.category = category;
    if (supplierId) query.supplierId = supplierId;
    if (packagingType) query.packagingType = packagingType;
    if (minGreenScore) query['sustainabilityMetrics.greenScore'] = { $gte: parseInt(minGreenScore) };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Role-based filtering
    if (req.user.role === 'supplier') {
      query.supplierId = req.user.supplierId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const products = await Product.find(query)
      .populate('supplierId', 'name ESGscore certificationLevel')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sortOptions);

    const total = await Product.countDocuments(query);

    res.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/products/:id
// @desc    Get product by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('supplierId', 'name ESGscore certificationLevel sustainabilityMetrics');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/products
// @desc    Create new product
// @access  Private
router.post('/', [
  authenticateToken,
  body('name').trim().isLength({ min: 2 }),
  body('sku').trim().isLength({ min: 3 }),
  body('category').isIn(['Fresh Produce', 'Dairy', 'Meat', 'Bakery', 'Pantry', 'Beverages', 'Frozen', 'Household', 'Electronics', 'Clothing']),
  body('supplierId').isMongoId(),
  body('price').isFloat({ min: 0 }),
  body('unit').isIn(['kg', 'lb', 'piece', 'liter', 'gallon', 'box', 'bottle']),
  body('baseSpoilageRate').optional().isFloat({ min: 0, max: 100 }),
  body('packagingType').isIn(['plastic', 'recyclable', 'compostable', 'biodegradable', 'minimal']),
  body('shelfLife').optional().isInt({ min: 1 }),
  body('certifications').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      sku,
      category,
      supplierId,
      description,
      price,
      unit,
      baseSpoilageRate = 5,
      packagingType,
      shelfLife = 7,
      storageConditions,
      certifications = [],
      sustainabilityMetrics
    } = req.body;

    // Check if SKU already exists
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      return res.status(400).json({ error: 'SKU already exists' });
    }

    // Verify supplier exists
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Role-based validation
    if (req.user.role === 'supplier' && req.user.supplierId?.toString() !== supplierId) {
      return res.status(403).json({ error: 'Can only create products for your own supplier account' });
    }

    const product = new Product({
      name,
      sku,
      category,
      supplierId,
      description,
      price,
      unit,
      baseSpoilageRate,
      packagingType,
      shelfLife,
      storageConditions,
      certifications,
      sustainabilityMetrics
    });

    // Green score is calculated automatically in the model
    await product.save();

    // Update supplier's products array
    await Supplier.findByIdAndUpdate(supplierId, {
      $push: { products: product._id }
    });

    // Populate supplier for response
    await product.populate('supplierId', 'name ESGscore');

    res.status(201).json({ product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private
router.put('/:id', [
  authenticateToken,
  body('name').optional().trim().isLength({ min: 2 }),
  body('category').optional().isIn(['Fresh Produce', 'Dairy', 'Meat', 'Bakery', 'Pantry', 'Beverages', 'Frozen', 'Household', 'Electronics', 'Clothing']),
  body('price').optional().isFloat({ min: 0 }),
  body('baseSpoilageRate').optional().isFloat({ min: 0, max: 100 }),
  body('packagingType').optional().isIn(['plastic', 'recyclable', 'compostable', 'biodegradable', 'minimal']),
  body('shelfLife').optional().isInt({ min: 1 }),
  body('certifications').optional().isArray(),
  body('sustainabilityMetrics').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Role-based validation
    if (req.user.role === 'supplier' && req.user.supplierId?.toString() !== product.supplierId.toString()) {
      return res.status(403).json({ error: 'Can only update products for your own supplier account' });
    }

    const updateData = { ...req.body };
    
    // Remove fields that shouldn't be updated
    delete updateData.sku;
    delete updateData.supplierId;
    delete updateData['sustainabilityMetrics.greenScore']; // This is calculated automatically

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('supplierId', 'name ESGscore');

    res.json({ product: updatedProduct });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/products/:id/predict-waste
// @desc    Get waste prediction for product
// @access  Private
router.get('/:id/predict-waste', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 7, region } = req.query;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get historical shipment data for this product
    const Shipment = require('../models/Shipment');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const shipments = await Shipment.find({
      productId: id,
      timestamp: { $gte: thirtyDaysAgo }
    });

    // Calculate average daily demand
    const totalQuantity = shipments.reduce((sum, shipment) => sum + shipment.quantity, 0);
    const avgDailyDemand = totalQuantity / 30;

    // Get current stock
    const currentStock = product.inventory.currentStock;

    // Simple waste prediction algorithm
    const predictedDemand = avgDailyDemand * parseInt(days);
    const predictedWaste = Math.max(0, currentStock - predictedDemand);
    const predictedWastePercentage = currentStock > 0 ? (predictedWaste / currentStock) * 100 : 0;

    // Calculate confidence based on data availability
    const confidence = Math.min(95, 50 + (shipments.length * 2));

    // Determine risk level
    let riskLevel = 'low';
    if (predictedWastePercentage > 30) riskLevel = 'critical';
    else if (predictedWastePercentage > 20) riskLevel = 'high';
    else if (predictedWastePercentage > 10) riskLevel = 'medium';

    const prediction = {
      product: {
        id: product._id,
        name: product.name,
        category: product.category,
        currentStock,
        baseSpoilageRate: product.baseSpoilageRate
      },
      prediction: {
        days: parseInt(days),
        predictedDemand: Math.round(predictedDemand * 100) / 100,
        predictedWaste: Math.round(predictedWaste * 100) / 100,
        predictedWastePercentage: Math.round(predictedWastePercentage * 100) / 100,
        riskLevel,
        confidence
      },
      factors: [
        {
          name: 'Historical Demand',
          impact: avgDailyDemand > 0 ? 1 : -1,
          description: `Average daily demand: ${Math.round(avgDailyDemand * 100) / 100} units`
        },
        {
          name: 'Current Stock',
          impact: currentStock > predictedDemand ? -1 : 1,
          description: `Current stock: ${currentStock} units`
        },
        {
          name: 'Base Spoilage Rate',
          impact: product.baseSpoilageRate > 10 ? -1 : 1,
          description: `Base spoilage rate: ${product.baseSpoilageRate}%`
        }
      ],
      recommendations: []
    };

    // Generate recommendations
    if (predictedWastePercentage > 20) {
      prediction.recommendations.push({
        action: 'Implement Discount Pricing',
        impact: 'high',
        description: 'Offer 20-30% discount to increase sales velocity',
        estimatedSavings: Math.round(predictedWaste * product.price * 0.5 * 100) / 100
      });
    }

    if (currentStock > predictedDemand * 2) {
      prediction.recommendations.push({
        action: 'Transfer to Other Stores',
        impact: 'medium',
        description: 'Transfer excess inventory to stores with higher demand',
        estimatedSavings: Math.round(predictedWaste * product.price * 0.3 * 100) / 100
      });
    }

    if (predictedWastePercentage > 15) {
      prediction.recommendations.push({
        action: 'Launch Promotional Campaign',
        impact: 'medium',
        description: 'Create targeted marketing campaign to boost sales',
        estimatedSavings: Math.round(predictedWaste * product.price * 0.4 * 100) / 100
      });
    }

    res.json({ prediction });
  } catch (error) {
    console.error('Predict waste error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/products/analytics/green-score
// @desc    Get green score analytics
// @access  Private
router.get('/analytics/green-score', authenticateToken, async (req, res) => {
  try {
    const { category, supplierId, minScore } = req.query;

    const query = { isActive: true };
    if (category) query.category = category;
    if (supplierId) query.supplierId = supplierId;
    if (minScore) query['sustainabilityMetrics.greenScore'] = { $gte: parseInt(minScore) };

    // Role-based filtering
    if (req.user.role === 'supplier') {
      query.supplierId = req.user.supplierId;
    }

    const products = await Product.find(query)
      .populate('supplierId', 'name ESGscore')
      .sort({ 'sustainabilityMetrics.greenScore': -1 });

    // Calculate analytics
    const totalProducts = products.length;
    const avgGreenScore = totalProducts > 0 
      ? products.reduce((sum, product) => sum + product.sustainabilityMetrics.greenScore, 0) / totalProducts 
      : 0;

    // Group by category
    const scoreByCategory = products.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = { products: [], avgScore: 0, count: 0 };
      }
      acc[product.category].products.push(product);
      acc[product.category].count += 1;
      return acc;
    }, {});

    // Calculate averages for each category
    Object.keys(scoreByCategory).forEach(category => {
      const categoryProducts = scoreByCategory[category].products;
      const avgScore = categoryProducts.reduce((sum, product) => sum + product.sustainabilityMetrics.greenScore, 0) / categoryProducts.length;
      scoreByCategory[category].avgScore = Math.round(avgScore * 100) / 100;
    });

    // Group by packaging type
    const scoreByPackaging = products.reduce((acc, product) => {
      if (!acc[product.packagingType]) {
        acc[product.packagingType] = { products: [], avgScore: 0, count: 0 };
      }
      acc[product.packagingType].products.push(product);
      acc[product.packagingType].count += 1;
      return acc;
    }, {});

    // Calculate averages for each packaging type
    Object.keys(scoreByPackaging).forEach(packaging => {
      const packagingProducts = scoreByPackaging[packaging].products;
      const avgScore = packagingProducts.reduce((sum, product) => sum + product.sustainabilityMetrics.greenScore, 0) / packagingProducts.length;
      scoreByPackaging[packaging].avgScore = Math.round(avgScore * 100) / 100;
    });

    // Top performing products
    const topProducts = products.slice(0, 10);

    const analytics = {
      summary: {
        totalProducts,
        avgGreenScore: Math.round(avgGreenScore * 100) / 100
      },
      scoreByCategory,
      scoreByPackaging,
      topProducts,
      distribution: {
        excellent: products.filter(p => p.sustainabilityMetrics.greenScore >= 80).length,
        good: products.filter(p => p.sustainabilityMetrics.greenScore >= 60 && p.sustainabilityMetrics.greenScore < 80).length,
        fair: products.filter(p => p.sustainabilityMetrics.greenScore >= 40 && p.sustainabilityMetrics.greenScore < 60).length,
        poor: products.filter(p => p.sustainabilityMetrics.greenScore < 40).length
      }
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get green score analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 