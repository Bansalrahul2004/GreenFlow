const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  origin: {
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  destination: {
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  distanceKm: {
    type: Number,
    required: true,
    min: 0
  },
  transportMode: {
    type: String,
    enum: ['diesel', 'electric', 'hybrid', 'rail', 'ship', 'air'],
    required: true
  },
  vehicleType: {
    type: String,
    enum: ['truck', 'van', 'car', 'train', 'ship', 'plane'],
    default: 'truck'
  },
  fuelEfficiency: {
    type: Number, // km per liter or equivalent
    default: 10
  },
  packagingWeight: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'in-transit', 'delivered', 'cancelled'],
    default: 'pending'
  },
  estimatedDelivery: {
    type: Date
  },
  actualDelivery: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
shipmentSchema.index({ supplierId: 1 });
shipmentSchema.index({ productId: 1 });
shipmentSchema.index({ timestamp: -1 });
shipmentSchema.index({ status: 1 });

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

// Method to calculate carbon footprint
shipmentSchema.methods.calculateCarbonFootprint = function() {
  try {
    console.log('Starting carbon footprint calculation with:', {
      distanceKm: this.distanceKm,
      transportMode: this.transportMode,
      vehicleType: this.vehicleType,
      quantity: this.quantity,
      packagingWeight: this.packagingWeight
    });

    // Validate required fields
    if (!this.distanceKm || !this.transportMode || !this.quantity) {
      console.log('Missing required fields for carbon calculation');
      return 0;
    }

    // Ensure all values are numbers
    const distanceKm = Number(this.distanceKm) || 0;
    const quantity = Number(this.quantity) || 0;
    const packagingWeight = Number(this.packagingWeight) || 0;
    const transportMode = String(this.transportMode);
    const vehicleType = String(this.vehicleType || 'truck');

    console.log('Processed values:', {
      distanceKm,
      transportMode,
      vehicleType,
      quantity,
      packagingWeight
    });

    let emissionFactor = 0.15; // Default fallback

    if (transportMode === 'rail' || transportMode === 'ship' || transportMode === 'air') {
      emissionFactor = emissionFactors[transportMode] || 0.1;
    } else {
      emissionFactor = emissionFactors[transportMode]?.[vehicleType] || emissionFactors.diesel?.truck || 0.15;
    }

    console.log('Selected emission factor:', emissionFactor);

    // Calculate total weight (product + packaging)
    const totalWeight = quantity + packagingWeight;

    // Calculate carbon emissions
    const carbonEmissions = distanceKm * emissionFactor * (totalWeight / 1000); // Convert to tons

    const result = Math.round(carbonEmissions * 100) / 100; // Round to 2 decimal places

    console.log('Carbon calculation result:', {
      distanceKm,
      emissionFactor,
      totalWeight,
      carbonEmissions,
      result
    });

    return result || 0; // Ensure we return 0 if calculation fails
  } catch (error) {
    console.error('Error in calculateCarbonFootprint:', error);
    return 0;
  }
};

// Virtual for carbon footprint calculation
shipmentSchema.virtual('carbonKg').get(function() {
  return this.calculateCarbonFootprint();
});

// Pre-save middleware to calculate carbon footprint
shipmentSchema.pre('save', function(next) {
  console.log('Pre-save middleware triggered. isNew:', this.isNew);
  next();
});

// Virtual for delivery status
shipmentSchema.virtual('deliveryStatus').get(function() {
  if (this.status === 'delivered') return 'completed';
  if (this.status === 'cancelled') return 'cancelled';
  if (this.estimatedDelivery && new Date() > this.estimatedDelivery) return 'delayed';
  return 'on-time';
});

// Virtual for carbon efficiency rating
shipmentSchema.virtual('carbonEfficiency').get(function() {
  const carbonPerUnit = this.carbonKg / this.quantity;
  
  if (carbonPerUnit < 0.1) return 'excellent';
  if (carbonPerUnit < 0.3) return 'good';
  if (carbonPerUnit < 0.5) return 'fair';
  return 'poor';
});

module.exports = mongoose.model('Shipment', shipmentSchema); 