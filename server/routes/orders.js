const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const Order = require('../models/Order');

const router = express.Router();

// @route   POST /api/orders/eco-options
// @desc    Record customer eco preferences
// @access  Public (with optional auth)
router.post('/eco-options', [
  optionalAuth,
  body('orderId').optional().trim(),
  body('customerEmail').optional().isEmail(),
  body('preferences').isObject(),
  body('preferences.minimalPackaging').optional().isBoolean(),
  body('preferences.greenDelivery').optional().isBoolean(),
  body('preferences.carbonOffset').optional().isBoolean(),
  body('preferences.localSourcing').optional().isBoolean(),
  body('preferences.bulkOrdering').optional().isBoolean(),
  body('items').optional().isArray(),
  body('totalAmount').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    // Only allow consumers to submit eco options
    if (!req.user || req.user.role !== 'consumer') {
      return res.status(403).json({ error: 'Only consumers can submit eco options.' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const {
      orderId,
      customerEmail,
      preferences,
      items = [],
      totalAmount = 0
    } = req.body;
    // Calculate eco impact
    const ecoImpact = calculateEcoImpact(preferences, items, totalAmount);
    // Save to DB
    const newOrder = await Order.create({
      orderId: orderId || generateOrderId(),
      customerEmail,
      customerId: req.user._id,
      preferences,
      items,
      totalAmount,
      ecoImpact,
      timestamp: new Date()
    });
    res.status(201).json({ 
      order: newOrder,
      message: 'Eco preferences recorded successfully'
    });
  } catch (error) {
    console.error('Record eco options error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/orders/eco-impact
// @desc    Calculate eco impact for order
// @access  Public
router.get('/eco-impact', async (req, res) => {
  try {
    const { 
      minimalPackaging = false,
      greenDelivery = false,
      carbonOffset = false,
      localSourcing = false,
      bulkOrdering = false,
      totalAmount = 0,
      items = []
    } = req.query;

    const preferences = {
      minimalPackaging: minimalPackaging === 'true',
      greenDelivery: greenDelivery === 'true',
      carbonOffset: carbonOffset === 'true',
      localSourcing: localSourcing === 'true',
      bulkOrdering: bulkOrdering === 'true'
    };

    const ecoImpact = calculateEcoImpact(preferences, items, parseFloat(totalAmount));

    res.json({ ecoImpact });
  } catch (error) {
    console.error('Calculate eco impact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/orders/analytics/eco-adoption
// @desc    Get eco options adoption analytics
// @access  Private
router.get('/analytics/eco-adoption', authenticateToken, async (req, res) => {
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

    // Mock data for demonstration
    // In a real app, this would come from the database
    const mockOrders = generateMockOrders(startDate, now);

    // Calculate adoption rates
    const totalOrders = mockOrders.length;
    const adoptionRates = {
      minimalPackaging: {
        adopted: mockOrders.filter(order => order.preferences.minimalPackaging).length,
        percentage: Math.round((mockOrders.filter(order => order.preferences.minimalPackaging).length / totalOrders) * 100)
      },
      greenDelivery: {
        adopted: mockOrders.filter(order => order.preferences.greenDelivery).length,
        percentage: Math.round((mockOrders.filter(order => order.preferences.greenDelivery).length / totalOrders) * 100)
      },
      carbonOffset: {
        adopted: mockOrders.filter(order => order.preferences.carbonOffset).length,
        percentage: Math.round((mockOrders.filter(order => order.preferences.carbonOffset).length / totalOrders) * 100)
      },
      localSourcing: {
        adopted: mockOrders.filter(order => order.preferences.localSourcing).length,
        percentage: Math.round((mockOrders.filter(order => order.preferences.localSourcing).length / totalOrders) * 100)
      },
      bulkOrdering: {
        adopted: mockOrders.filter(order => order.preferences.bulkOrdering).length,
        percentage: Math.round((mockOrders.filter(order => order.preferences.bulkOrdering).length / totalOrders) * 100)
      }
    };

    // Calculate total impact
    const totalImpact = mockOrders.reduce((sum, order) => {
      return sum + order.ecoImpact.carbonSaved + order.ecoImpact.wasteReduced;
    }, 0);

    // Daily adoption trends
    const dailyAdoption = {};
    mockOrders.forEach(order => {
      const date = order.timestamp.toISOString().split('T')[0];
      if (!dailyAdoption[date]) {
        dailyAdoption[date] = { orders: 0, ecoAdoptions: 0 };
      }
      dailyAdoption[date].orders += 1;
      
      const ecoOptionsCount = Object.values(order.preferences).filter(Boolean).length;
      dailyAdoption[date].ecoAdoptions += ecoOptionsCount;
    });

    const analytics = {
      summary: {
        totalOrders,
        totalImpact: Math.round(totalImpact * 100) / 100,
        avgEcoOptionsPerOrder: Math.round(
          mockOrders.reduce((sum, order) => 
            sum + Object.values(order.preferences).filter(Boolean).length, 0
          ) / totalOrders * 100
        ) / 100
      },
      adoptionRates,
      dailyAdoption: Object.entries(dailyAdoption).map(([date, data]) => ({
        date,
        orders: data.orders,
        ecoAdoptions: data.ecoAdoptions,
        adoptionRate: Math.round((data.ecoAdoptions / data.orders) * 100)
      })).sort((a, b) => new Date(a.date) - new Date(b.date)),
      period,
      startDate,
      endDate: now
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get eco adoption analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/orders/recommendations
// @desc    Get personalized eco recommendations
// @access  Private
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.user;
    const { orderHistory = [], preferences = {} } = req.query;

    // Analyze customer behavior and generate recommendations
    const recommendations = generateRecommendations(orderHistory, preferences);

    res.json({ recommendations });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/orders
// @desc    Get all orders with filtering
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      period = '30d',
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;
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
    // Build query
    const query = { timestamp: { $gte: startDate, $lte: now } };
    if (req.user.role === 'consumer') {
      query.customerId = req.user._id;
    }
    // Fetch from DB
    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper functions
function calculateEcoImpact(preferences, items, totalAmount) {
  let carbonSaved = 0;
  let wasteReduced = 0;
  let costSavings = 0;

  // Minimal packaging impact
  if (preferences.minimalPackaging) {
    carbonSaved += totalAmount * 0.1; // 10% of order value in kg CO2
    wasteReduced += totalAmount * 0.05; // 5% of order value in kg waste
    costSavings += totalAmount * 0.02; // 2% cost savings
  }

  // Green delivery impact
  if (preferences.greenDelivery) {
    carbonSaved += totalAmount * 0.15; // 15% of order value in kg CO2
    costSavings += totalAmount * 0.01; // 1% cost savings
  }

  // Carbon offset impact
  if (preferences.carbonOffset) {
    carbonSaved += totalAmount * 0.2; // 20% of order value in kg CO2
    costSavings -= totalAmount * 0.03; // 3% additional cost
  }

  // Local sourcing impact
  if (preferences.localSourcing) {
    carbonSaved += totalAmount * 0.12; // 12% of order value in kg CO2
    wasteReduced += totalAmount * 0.03; // 3% of order value in kg waste
  }

  // Bulk ordering impact
  if (preferences.bulkOrdering) {
    carbonSaved += totalAmount * 0.08; // 8% of order value in kg CO2
    wasteReduced += totalAmount * 0.04; // 4% of order value in kg waste
    costSavings += totalAmount * 0.05; // 5% cost savings
  }

  return {
    carbonSaved: Math.round(carbonSaved * 100) / 100,
    wasteReduced: Math.round(wasteReduced * 100) / 100,
    costSavings: Math.round(costSavings * 100) / 100,
    totalImpact: Math.round((carbonSaved + wasteReduced) * 100) / 100
  };
}

function generateOrderId() {
  return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function generateMockOrders(startDate, endDate) {
  const orders = [];
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  for (let i = 0; i < days * 10; i++) { // 10 orders per day on average
    const timestamp = new Date(startDate.getTime() + Math.random() * (endDate - startDate));
    const totalAmount = 50 + Math.random() * 200; // $50-$250 orders
    
    const preferences = {
      minimalPackaging: Math.random() > 0.6, // 40% adoption
      greenDelivery: Math.random() > 0.7, // 30% adoption
      carbonOffset: Math.random() > 0.8, // 20% adoption
      localSourcing: Math.random() > 0.65, // 35% adoption
      bulkOrdering: Math.random() > 0.75 // 25% adoption
    };

    const items = [
      { name: 'Organic Apples', quantity: 2, price: 5.99 },
      { name: 'Eco-friendly Detergent', quantity: 1, price: 12.99 }
    ];

    const ecoImpact = calculateEcoImpact(preferences, items, totalAmount);

    orders.push({
      orderId: generateOrderId(),
      customerEmail: `customer${i}@example.com`,
      preferences,
      items,
      totalAmount: Math.round(totalAmount * 100) / 100,
      ecoImpact,
      timestamp
    });
  }

  return orders;
}

function generateRecommendations(orderHistory, preferences) {
  const recommendations = [];

  // Analyze order frequency
  if (orderHistory.length < 3) {
    recommendations.push({
      type: 'bulk_ordering',
      title: 'Consider Bulk Ordering',
      description: 'Ordering in bulk can reduce packaging waste and shipping emissions',
      impact: 'high',
      estimatedSavings: 15
    });
  }

  // Check if minimal packaging is not being used
  if (!preferences.minimalPackaging) {
    recommendations.push({
      type: 'minimal_packaging',
      title: 'Try Minimal Packaging',
      description: 'Choose minimal packaging options to reduce waste',
      impact: 'medium',
      estimatedSavings: 8
    });
  }

  // Check if green delivery is not being used
  if (!preferences.greenDelivery) {
    recommendations.push({
      type: 'green_delivery',
      title: 'Switch to Green Delivery',
      description: 'Green delivery options use electric vehicles and reduce emissions',
      impact: 'high',
      estimatedSavings: 12
    });
  }

  // Check if local sourcing is not being used
  if (!preferences.localSourcing) {
    recommendations.push({
      type: 'local_sourcing',
      title: 'Choose Local Products',
      description: 'Local products have lower transportation emissions',
      impact: 'medium',
      estimatedSavings: 10
    });
  }

  // Check if carbon offset is not being used
  if (!preferences.carbonOffset) {
    recommendations.push({
      type: 'carbon_offset',
      title: 'Offset Your Carbon Footprint',
      description: 'Carbon offset programs help neutralize your environmental impact',
      impact: 'medium',
      estimatedSavings: 5
    });
  }

  return recommendations.sort((a, b) => {
    const impactOrder = { high: 3, medium: 2, low: 1 };
    return impactOrder[b.impact] - impactOrder[a.impact];
  });
}

module.exports = router; 