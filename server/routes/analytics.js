const express = require('express');
const { authenticateToken, isAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get comprehensive dashboard analytics
// @access  Private
router.get('/dashboard', authenticateToken, async (req, res) => {
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

    // Get data from different collections
    const [Shipment, Supplier, Product, WasteAlert] = await Promise.all([
      require('../models/Shipment'),
      require('../models/Supplier'),
      require('../models/Product'),
      require('../models/WasteAlert')
    ]);

    const [shipments, suppliers, products, alerts] = await Promise.all([
      Shipment.find(query).populate('supplierId', 'name'),
      Supplier.find(query.supplierId ? { _id: query.supplierId } : {}),
      Product.find({ isActive: true }),
      WasteAlert.find({ alertDate: { $gte: startDate } })
    ]);

    // Calculate key metrics
    const totalCarbon = shipments.reduce((sum, shipment) => sum + shipment.carbonKg, 0);
    const totalShipments = shipments.length;
    const avgCarbonPerShipment = totalShipments > 0 ? totalCarbon / totalShipments : 0;

    const totalSuppliers = suppliers.length;
    const avgESGScore = totalSuppliers > 0 
      ? suppliers.reduce((sum, supplier) => sum + supplier.ESGscore, 0) / totalSuppliers 
      : 0;

    const totalProducts = products.length;
    const avgGreenScore = totalProducts > 0 
      ? products.reduce((sum, product) => sum + product.sustainabilityMetrics.greenScore, 0) / totalProducts 
      : 0;

    const activeAlerts = alerts.filter(alert => alert.status === 'active').length;
    const criticalAlerts = alerts.filter(alert => alert.riskLevel === 'critical').length;

    // Calculate trends
    const dailyCarbon = {};
    shipments.forEach(shipment => {
      const date = shipment.timestamp.toISOString().split('T')[0];
      dailyCarbon[date] = (dailyCarbon[date] || 0) + shipment.carbonKg;
    });

    const dailyAlerts = {};
    alerts.forEach(alert => {
      const date = alert.alertDate.toISOString().split('T')[0];
      dailyAlerts[date] = (dailyAlerts[date] || 0) + 1;
    });

    // Calculate efficiency metrics
    const transportModes = shipments.reduce((acc, shipment) => {
      acc[shipment.transportMode] = (acc[shipment.transportMode] || 0) + 1;
      return acc;
    }, {});

    const carbonByMode = shipments.reduce((acc, shipment) => {
      if (!acc[shipment.transportMode]) {
        acc[shipment.transportMode] = { total: 0, count: 0, avg: 0 };
      }
      acc[shipment.transportMode].total += shipment.carbonKg;
      acc[shipment.transportMode].count += 1;
      return acc;
    }, {});

    // Calculate averages
    Object.keys(carbonByMode).forEach(mode => {
      carbonByMode[mode].avg = carbonByMode[mode].total / carbonByMode[mode].count;
    });

    // Calculate potential savings
    const potentialSavings = calculatePotentialSavings(shipments, products, alerts);

    const dashboard = {
      summary: {
        totalCarbon: Math.round(totalCarbon * 100) / 100,
        totalShipments,
        avgCarbonPerShipment: Math.round(avgCarbonPerShipment * 100) / 100,
        totalSuppliers,
        avgESGScore: Math.round(avgESGScore * 100) / 100,
        totalProducts,
        avgGreenScore: Math.round(avgGreenScore * 100) / 100,
        activeAlerts,
        criticalAlerts
      },
      trends: {
        dailyCarbon: Object.entries(dailyCarbon).map(([date, carbon]) => ({
          date,
          carbon: Math.round(carbon * 100) / 100
        })).sort((a, b) => new Date(a.date) - new Date(b.date)),
        dailyAlerts: Object.entries(dailyAlerts).map(([date, count]) => ({
          date,
          count
        })).sort((a, b) => new Date(a.date) - new Date(b.date))
      },
      efficiency: {
        transportModes,
        carbonByMode,
        potentialSavings
      },
      period,
      startDate,
      endDate: now
    };

    res.json({ dashboard });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/analytics/sustainability-score
// @desc    Get overall sustainability score
// @access  Private
router.get('/sustainability-score', authenticateToken, async (req, res) => {
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

    const [Shipment, Supplier, Product, WasteAlert] = await Promise.all([
      require('../models/Shipment'),
      require('../models/Supplier'),
      require('../models/Product'),
      require('../models/WasteAlert')
    ]);

    const [shipments, suppliers, products, alerts] = await Promise.all([
      Shipment.find(query),
      Supplier.find(query.supplierId ? { _id: query.supplierId } : {}),
      Product.find({ isActive: true }),
      WasteAlert.find({ alertDate: { $gte: startDate } })
    ]);

    // Calculate sustainability score components
    const carbonScore = calculateCarbonScore(shipments);
    const supplierScore = calculateSupplierScore(suppliers);
    const productScore = calculateProductScore(products);
    const wasteScore = calculateWasteScore(alerts);

    // Weighted average
    const sustainabilityScore = Math.round(
      (carbonScore * 0.3 + supplierScore * 0.25 + productScore * 0.25 + wasteScore * 0.2) * 100
    ) / 100;

    const scoreBreakdown = {
      carbonScore: Math.round(carbonScore * 100) / 100,
      supplierScore: Math.round(supplierScore * 100) / 100,
      productScore: Math.round(productScore * 100) / 100,
      wasteScore: Math.round(wasteScore * 100) / 100,
      overallScore: sustainabilityScore
    };

    // Get score category
    const scoreCategory = getScoreCategory(sustainabilityScore);

    // Get improvement recommendations
    const recommendations = getImprovementRecommendations(scoreBreakdown);

    const analytics = {
      score: scoreBreakdown,
      category: scoreCategory,
      recommendations,
      period,
      startDate,
      endDate: now
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get sustainability score error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/analytics/performance-comparison
// @desc    Get performance comparison with industry benchmarks
// @access  Private
router.get('/performance-comparison', authenticateToken, async (req, res) => {
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

    const Shipment = require('../models/Shipment');
    const shipments = await Shipment.find(query);

    // Calculate actual metrics
    const totalCarbon = shipments.reduce((sum, shipment) => sum + shipment.carbonKg, 0);
    const totalDistance = shipments.reduce((sum, shipment) => sum + shipment.distanceKm, 0);
    const avgCarbonPerKm = totalDistance > 0 ? totalCarbon / totalDistance : 0;

    // Industry benchmarks (kg CO2 per km per ton)
    const benchmarks = {
      retail: {
        carbonPerKm: 0.15,
        description: 'Average retail supply chain'
      },
      sustainable: {
        carbonPerKm: 0.08,
        description: 'Sustainable retail leaders'
      },
      green: {
        carbonPerKm: 0.05,
        description: 'Green retail innovators'
      }
    };

    // Calculate performance vs benchmarks
    const performance = {
      current: {
        carbonPerKm: Math.round(avgCarbonPerKm * 1000) / 1000,
        totalCarbon: Math.round(totalCarbon * 100) / 100,
        totalDistance: Math.round(totalDistance * 100) / 100
      },
      comparison: {
        retail: {
          benchmark: benchmarks.retail.carbonPerKm,
          percentage: Math.round((avgCarbonPerKm / benchmarks.retail.carbonPerKm) * 100),
          status: avgCarbonPerKm <= benchmarks.retail.carbonPerKm ? 'better' : 'worse'
        },
        sustainable: {
          benchmark: benchmarks.sustainable.carbonPerKm,
          percentage: Math.round((avgCarbonPerKm / benchmarks.sustainable.carbonPerKm) * 100),
          status: avgCarbonPerKm <= benchmarks.sustainable.carbonPerKm ? 'better' : 'worse'
        },
        green: {
          benchmark: benchmarks.green.carbonPerKm,
          percentage: Math.round((avgCarbonPerKm / benchmarks.green.carbonPerKm) * 100),
          status: avgCarbonPerKm <= benchmarks.green.carbonPerKm ? 'better' : 'worse'
        }
      }
    };

    // Calculate improvement potential
    const improvementPotential = {
      toSustainable: Math.round((avgCarbonPerKm - benchmarks.sustainable.carbonPerKm) * totalDistance * 100) / 100,
      toGreen: Math.round((avgCarbonPerKm - benchmarks.green.carbonPerKm) * totalDistance * 100) / 100
    };

    const analytics = {
      performance,
      improvementPotential,
      benchmarks,
      period,
      startDate,
      endDate: now
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get performance comparison error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper functions
function calculatePotentialSavings(shipments, products, alerts) {
  let carbonSavings = 0;
  let wasteSavings = 0;
  let costSavings = 0;

  // Carbon savings from switching to electric vehicles
  const dieselShipments = shipments.filter(s => s.transportMode === 'diesel');
  dieselShipments.forEach(shipment => {
    const electricCarbon = shipment.carbonKg * 0.33; // Electric is ~3x more efficient
    carbonSavings += shipment.carbonKg - electricCarbon;
  });

  // Waste savings from alerts
  alerts.forEach(alert => {
    if (alert.status === 'active' && alert.predictedWasteQty > 0) {
      wasteSavings += alert.predictedWasteQty;
      costSavings += alert.predictedWasteQty * 10; // Assume $10 per unit
    }
  });

  // Product optimization savings
  const lowGreenScoreProducts = products.filter(p => p.sustainabilityMetrics.greenScore < 50);
  lowGreenScoreProducts.forEach(product => {
    costSavings += product.price * 0.05; // 5% potential savings
  });

  return {
    carbonSavings: Math.round(carbonSavings * 100) / 100,
    wasteSavings: Math.round(wasteSavings * 100) / 100,
    costSavings: Math.round(costSavings * 100) / 100,
    totalSavings: Math.round((carbonSavings + wasteSavings + costSavings) * 100) / 100
  };
}

function calculateCarbonScore(shipments) {
  if (shipments.length === 0) return 0;

  const totalCarbon = shipments.reduce((sum, shipment) => sum + shipment.carbonKg, 0);
  const avgCarbonPerShipment = totalCarbon / shipments.length;

  // Score based on average carbon per shipment
  // Lower carbon = higher score
  if (avgCarbonPerShipment < 5) return 100;
  if (avgCarbonPerShipment < 10) return 80;
  if (avgCarbonPerShipment < 20) return 60;
  if (avgCarbonPerShipment < 50) return 40;
  return 20;
}

function calculateSupplierScore(suppliers) {
  if (suppliers.length === 0) return 0;

  const avgESGScore = suppliers.reduce((sum, supplier) => sum + supplier.ESGscore, 0) / suppliers.length;
  return Math.min(100, avgESGScore);
}

function calculateProductScore(products) {
  if (products.length === 0) return 0;

  const avgGreenScore = products.reduce((sum, product) => sum + product.sustainabilityMetrics.greenScore, 0) / products.length;
  return Math.min(100, avgGreenScore);
}

function calculateWasteScore(alerts) {
  if (alerts.length === 0) return 100;

  const activeAlerts = alerts.filter(alert => alert.status === 'active');
  const criticalAlerts = activeAlerts.filter(alert => alert.riskLevel === 'critical');
  
  // Score based on alert severity and resolution rate
  const resolutionRate = alerts.filter(alert => alert.status === 'resolved').length / alerts.length;
  const criticalRate = criticalAlerts.length / activeAlerts.length;

  let score = resolutionRate * 100;
  score -= criticalRate * 30; // Penalty for critical alerts

  return Math.max(0, Math.min(100, score));
}

function getScoreCategory(score) {
  if (score >= 80) return { category: 'Excellent', color: 'green', description: 'Leading sustainability performance' };
  if (score >= 60) return { category: 'Good', color: 'blue', description: 'Above average sustainability performance' };
  if (score >= 40) return { category: 'Fair', color: 'yellow', description: 'Average sustainability performance' };
  return { category: 'Poor', color: 'red', description: 'Below average sustainability performance' };
}

function getImprovementRecommendations(scoreBreakdown) {
  const recommendations = [];

  if (scoreBreakdown.carbonScore < 60) {
    recommendations.push({
      type: 'carbon',
      title: 'Reduce Carbon Emissions',
      description: 'Switch to electric vehicles and optimize routes',
      impact: 'high',
      potentialImprovement: 20
    });
  }

  if (scoreBreakdown.supplierScore < 60) {
    recommendations.push({
      type: 'supplier',
      title: 'Improve Supplier ESG Scores',
      description: 'Work with suppliers to improve their sustainability practices',
      impact: 'medium',
      potentialImprovement: 15
    });
  }

  if (scoreBreakdown.productScore < 60) {
    recommendations.push({
      type: 'product',
      title: 'Enhance Product Sustainability',
      description: 'Improve packaging and sourcing practices',
      impact: 'medium',
      potentialImprovement: 15
    });
  }

  if (scoreBreakdown.wasteScore < 60) {
    recommendations.push({
      type: 'waste',
      title: 'Reduce Waste',
      description: 'Implement better inventory management and waste reduction strategies',
      impact: 'high',
      potentialImprovement: 25
    });
  }

  return recommendations.sort((a, b) => {
    const impactOrder = { high: 3, medium: 2, low: 1 };
    return impactOrder[b.impact] - impactOrder[a.impact];
  });
}

module.exports = router; 