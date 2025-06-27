const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/routes/optimize
// @desc    Get optimized green delivery routes
// @access  Private
router.get('/optimize', authenticateToken, async (req, res) => {
  try {
    const { from, to, weight, transportMode, vehicleType } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

    // Parse coordinates
    const [fromLat, fromLng] = from.split(',').map(Number);
    const [toLat, toLng] = to.split(',').map(Number);

    if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
      return res.status(400).json({ error: 'Invalid coordinates format. Use "lat,lng"' });
    }

    // Calculate distance using Haversine formula
    const distance = calculateDistance(fromLat, fromLng, toLat, toLng);
    
    // Generate route options based on transport mode
    const routes = generateRouteOptions(
      fromLat, fromLng, toLat, toLng, 
      distance, 
      weight || 1000, 
      transportMode || 'diesel',
      vehicleType || 'truck'
    );

    res.json({ routes });
  } catch (error) {
    console.error('Route optimization error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/routes/calculate-carbon
// @desc    Calculate carbon footprint for a route
// @access  Private
router.post('/calculate-carbon', [
  authenticateToken,
  body('origin').isObject(),
  body('destination').isObject(),
  body('distanceKm').isFloat({ min: 0 }),
  body('transportMode').isIn(['diesel', 'electric', 'hybrid', 'rail', 'ship', 'air']),
  body('vehicleType').optional().isIn(['truck', 'van', 'car', 'train', 'ship', 'plane']),
  body('weight').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      origin,
      destination,
      distanceKm,
      transportMode,
      vehicleType = 'truck',
      weight = 1000
    } = req.body;

    // Carbon emission factors (kg CO2 per km per ton)
    const emissionFactors = {
      diesel: {
        truck: 0.15,
        van: 0.12,
        car: 0.08
      },
      electric: {
        truck: 0.05,
        van: 0.04,
        car: 0.02
      },
      hybrid: {
        truck: 0.10,
        van: 0.08,
        car: 0.05
      },
      rail: 0.03,
      ship: 0.02,
      air: 0.50
    };

    let emissionFactor = 0;
    if (transportMode === 'rail' || transportMode === 'ship' || transportMode === 'air') {
      emissionFactor = emissionFactors[transportMode];
    } else {
      emissionFactor = emissionFactors[transportMode]?.[vehicleType] || emissionFactors.diesel.truck;
    }

    const carbonKg = distanceKm * emissionFactor * (weight / 1000);
    const carbonPerKm = carbonKg / distanceKm;
    const carbonPerTonKm = carbonKg / (weight / 1000) / distanceKm;

    const calculation = {
      route: {
        origin,
        destination,
        distanceKm,
        transportMode,
        vehicleType,
        weight
      },
      carbonFootprint: {
        totalKg: Math.round(carbonKg * 100) / 100,
        perKm: Math.round(carbonPerKm * 1000) / 1000,
        perTonKm: Math.round(carbonPerTonKm * 1000) / 1000
      },
      efficiency: {
        rating: getEfficiencyRating(carbonPerTonKm),
        comparison: getEfficiencyComparison(transportMode, carbonPerTonKm)
      }
    };

    res.json({ calculation });
  } catch (error) {
    console.error('Calculate carbon error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/routes/transport-modes
// @desc    Get available transport modes with efficiency data
// @access  Private
router.get('/transport-modes', authenticateToken, async (req, res) => {
  try {
    const transportModes = [
      {
        mode: 'electric',
        vehicles: ['truck', 'van', 'car'],
        avgEfficiency: 0.04, // kg CO2 per km per ton
        pros: ['Zero direct emissions', 'Lower operating costs', 'Quieter operation'],
        cons: ['Limited range', 'Charging infrastructure', 'Higher upfront cost'],
        bestFor: ['Urban deliveries', 'Short distances', 'Last-mile delivery']
      },
      {
        mode: 'hybrid',
        vehicles: ['truck', 'van', 'car'],
        avgEfficiency: 0.08,
        pros: ['Reduced emissions', 'Better fuel economy', 'Flexible operation'],
        cons: ['Higher cost', 'Complex maintenance', 'Limited electric range'],
        bestFor: ['Mixed urban/rural routes', 'Medium distances', 'Variable loads']
      },
      {
        mode: 'rail',
        vehicles: ['train'],
        avgEfficiency: 0.03,
        pros: ['Very efficient', 'High capacity', 'Low emissions'],
        cons: ['Limited routes', 'Fixed schedules', 'Last-mile challenges'],
        bestFor: ['Long distances', 'Bulk cargo', 'Intercity transport']
      },
      {
        mode: 'ship',
        vehicles: ['ship'],
        avgEfficiency: 0.02,
        pros: ['Lowest emissions', 'High capacity', 'Global reach'],
        cons: ['Slow speed', 'Port limitations', 'Weather dependent'],
        bestFor: ['International shipping', 'Bulk commodities', 'Non-urgent cargo']
      },
      {
        mode: 'diesel',
        vehicles: ['truck', 'van', 'car'],
        avgEfficiency: 0.15,
        pros: ['Wide availability', 'Proven technology', 'Long range'],
        cons: ['High emissions', 'Fuel costs', 'Environmental impact'],
        bestFor: ['Rural areas', 'Heavy loads', 'Long distances without alternatives']
      },
      {
        mode: 'air',
        vehicles: ['plane'],
        avgEfficiency: 0.50,
        pros: ['Fastest delivery', 'Global reach', 'Reliable schedules'],
        cons: ['Highest emissions', 'High cost', 'Limited capacity'],
        bestFor: ['Urgent deliveries', 'High-value goods', 'International express']
      }
    ];

    res.json({ transportModes });
  } catch (error) {
    console.error('Get transport modes error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET /api/routes/analytics/efficiency
// @desc    Get route efficiency analytics
// @access  Private
router.get('/analytics/efficiency', authenticateToken, async (req, res) => {
  try {
    const { period = '30d', transportMode } = req.query;

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
    if (transportMode) query.transportMode = transportMode;

    // Role-based filtering
    if (req.user.role === 'supplier') {
      query.supplierId = req.user.supplierId;
    }

    const Shipment = require('../models/Shipment');
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
        count: items.length,
        totalDistance: items.reduce((sum, item) => sum + item.distance, 0),
        totalCarbon: items.reduce((sum, item) => sum + (item.carbonPerUnit * item.quantity), 0)
      };
    });

    // Find most efficient routes
    const mostEfficient = efficiencyData
      .sort((a, b) => a.carbonPerUnit - b.carbonPerUnit)
      .slice(0, 10);

    // Calculate potential savings
    const totalCarbon = efficiencyData.reduce((sum, item) => sum + (item.carbonPerUnit * item.quantity), 0);
    const avgCarbonPerUnit = totalCarbon / efficiencyData.reduce((sum, item) => sum + item.quantity, 0);
    
    // Calculate potential savings by switching to electric
    const potentialSavings = efficiencyData.reduce((sum, item) => {
      if (item.transportMode === 'diesel') {
        const electricCarbonPerUnit = item.carbonPerUnit * 0.33; // Electric is ~3x more efficient
        return sum + ((item.carbonPerUnit - electricCarbonPerUnit) * item.quantity);
      }
      return sum;
    }, 0);

    const analytics = {
      summary: {
        totalShipments: shipments.length,
        totalDistance: efficiencyData.reduce((sum, item) => sum + item.distance, 0),
        totalCarbon: Math.round(totalCarbon * 100) / 100,
        avgCarbonPerUnit: Math.round(avgCarbonPerUnit * 1000) / 1000,
        potentialSavings: Math.round(potentialSavings * 100) / 100
      },
      modeAverages,
      mostEfficient,
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

// Helper functions
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function generateRouteOptions(fromLat, fromLng, toLat, toLng, distance, weight, transportMode, vehicleType) {
  const routes = [];

  // Route 1: Direct route (current mode)
  routes.push({
    id: 1,
    name: 'Direct Route',
    description: 'Most direct path using current transport mode',
    waypoints: [
      { lat: fromLat, lng: fromLng, name: 'Origin' },
      { lat: toLat, lng: toLng, name: 'Destination' }
    ],
    distance: Math.round(distance * 100) / 100,
    estimatedTime: Math.round(distance / getAverageSpeed(transportMode) * 60), // minutes
    carbonFootprint: calculateRouteCarbon(distance, weight, transportMode, vehicleType),
    transportMode,
    vehicleType,
    efficiency: getEfficiencyRating(calculateRouteCarbon(distance, weight, transportMode, vehicleType) / (weight / 1000) / distance)
  });

  // Route 2: Green alternative (if not already green)
  if (transportMode !== 'electric' && transportMode !== 'rail') {
    routes.push({
      id: 2,
      name: 'Green Alternative',
      description: 'Route optimized for lower emissions',
      waypoints: [
        { lat: fromLat, lng: fromLng, name: 'Origin' },
        { lat: toLat, lng: toLng, name: 'Destination' }
      ],
      distance: Math.round(distance * 1.1 * 100) / 100, // 10% longer for green route
      estimatedTime: Math.round(distance * 1.1 / getAverageSpeed('electric') * 60),
      carbonFootprint: calculateRouteCarbon(distance * 1.1, weight, 'electric', 'truck'),
      transportMode: 'electric',
      vehicleType: 'truck',
      efficiency: 'excellent',
      savings: Math.round((calculateRouteCarbon(distance, weight, transportMode, vehicleType) - 
                          calculateRouteCarbon(distance * 1.1, weight, 'electric', 'truck')) * 100) / 100
    });
  }

  // Route 3: Multi-modal (if distance > 100km)
  if (distance > 100) {
    routes.push({
      id: 3,
      name: 'Multi-modal Route',
      description: 'Combines rail and road transport for efficiency',
      waypoints: [
        { lat: fromLat, lng: fromLng, name: 'Origin (Road)' },
        { lat: (fromLat + toLat) / 2, lng: (fromLng + toLng) / 2, name: 'Rail Transfer' },
        { lat: toLat, lng: toLng, name: 'Destination (Road)' }
      ],
      distance: Math.round(distance * 1.2 * 100) / 100, // 20% longer for multi-modal
      estimatedTime: Math.round(distance * 1.2 / getAverageSpeed('rail') * 60),
      carbonFootprint: calculateRouteCarbon(distance * 1.2, weight, 'rail', 'train'),
      transportMode: 'rail',
      vehicleType: 'train',
      efficiency: 'excellent',
      savings: Math.round((calculateRouteCarbon(distance, weight, transportMode, vehicleType) - 
                          calculateRouteCarbon(distance * 1.2, weight, 'rail', 'train')) * 100) / 100
    });
  }

  return routes.sort((a, b) => a.carbonFootprint - b.carbonFootprint);
}

function calculateRouteCarbon(distance, weight, transportMode, vehicleType) {
  const emissionFactors = {
    diesel: { truck: 0.15, van: 0.12, car: 0.08 },
    electric: { truck: 0.05, van: 0.04, car: 0.02 },
    hybrid: { truck: 0.10, van: 0.08, car: 0.05 },
    rail: 0.03,
    ship: 0.02,
    air: 0.50
  };

  let emissionFactor = 0;
  if (transportMode === 'rail' || transportMode === 'ship' || transportMode === 'air') {
    emissionFactor = emissionFactors[transportMode];
  } else {
    emissionFactor = emissionFactors[transportMode]?.[vehicleType] || emissionFactors.diesel.truck;
  }

  return Math.round(distance * emissionFactor * (weight / 1000) * 100) / 100;
}

function getAverageSpeed(transportMode) {
  const speeds = {
    diesel: 60, // km/h
    electric: 50,
    hybrid: 55,
    rail: 80,
    ship: 25,
    air: 800
  };
  return speeds[transportMode] || 60;
}

function getEfficiencyRating(carbonPerTonKm) {
  if (carbonPerTonKm < 0.05) return 'excellent';
  if (carbonPerTonKm < 0.1) return 'good';
  if (carbonPerTonKm < 0.2) return 'fair';
  return 'poor';
}

function getEfficiencyComparison(transportMode, carbonPerTonKm) {
  const benchmarks = {
    electric: 0.04,
    hybrid: 0.08,
    rail: 0.03,
    ship: 0.02,
    diesel: 0.15,
    air: 0.50
  };

  const benchmark = benchmarks[transportMode] || 0.15;
  const percentage = Math.round((carbonPerTonKm / benchmark) * 100);
  
  if (percentage <= 100) {
    return `${percentage}% of typical ${transportMode} emissions`;
  } else {
    return `${percentage}% of typical ${transportMode} emissions (above average)`;
  }
}

module.exports = router; 