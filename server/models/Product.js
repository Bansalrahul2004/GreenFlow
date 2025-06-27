const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Fresh Produce', 'Dairy', 'Meat', 'Bakery', 'Pantry', 'Beverages', 'Frozen', 'Household', 'Electronics', 'Clothing']
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    enum: ['kg', 'lb', 'piece', 'liter', 'gallon', 'box', 'bottle'],
    required: true
  },
  baseSpoilageRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 5 // percentage
  },
  packagingType: {
    type: String,
    enum: ['plastic', 'recyclable', 'compostable', 'biodegradable', 'minimal'],
    default: 'plastic'
  },
  sustainabilityMetrics: {
    carbonFootprint: {
      type: Number,
      default: 0 // kg CO2 per unit
    },
    waterFootprint: {
      type: Number,
      default: 0 // liters per unit
    },
    greenScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    }
  },
  inventory: {
    currentStock: {
      type: Number,
      default: 0,
      min: 0
    },
    reorderPoint: {
      type: Number,
      default: 10,
      min: 0
    },
    maxStock: {
      type: Number,
      default: 1000,
      min: 0
    }
  },
  shelfLife: {
    type: Number,
    default: 7, // days
    min: 1
  },
  storageConditions: {
    temperature: {
      min: Number,
      max: Number
    },
    humidity: {
      min: Number,
      max: Number
    },
    lightSensitive: {
      type: Boolean,
      default: false
    }
  },
  certifications: [{
    type: String,
    enum: ['Organic', 'Fair Trade', 'Non-GMO', 'Vegan', 'Gluten-Free', 'Kosher', 'Halal']
  }],
  images: [{
    url: String,
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [String]
}, {
  timestamps: true
});

// Indexes for efficient queries
productSchema.index({ category: 1 });
productSchema.index({ supplierId: 1 });
productSchema.index({ 'sustainabilityMetrics.greenScore': -1 });
productSchema.index({ isActive: 1 });

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  if (this.inventory.currentStock === 0) return 'out-of-stock';
  if (this.inventory.currentStock <= this.inventory.reorderPoint) return 'low-stock';
  return 'in-stock';
});

// Virtual for green score category
productSchema.virtual('greenScoreCategory').get(function() {
  if (this.sustainabilityMetrics.greenScore >= 80) return 'Excellent';
  if (this.sustainabilityMetrics.greenScore >= 60) return 'Good';
  if (this.sustainabilityMetrics.greenScore >= 40) return 'Fair';
  return 'Poor';
});

// Method to calculate green score
productSchema.methods.calculateGreenScore = function() {
  let score = 50; // Base score
  
  // Packaging impact
  const packagingScores = {
    'minimal': 25,
    'compostable': 20,
    'biodegradable': 15,
    'recyclable': 10,
    'plastic': -10
  };
  
  score += packagingScores[this.packagingType] || 0;
  
  // Carbon footprint impact
  if (this.sustainabilityMetrics.carbonFootprint < 1) score += 20;
  else if (this.sustainabilityMetrics.carbonFootprint < 5) score += 15;
  else if (this.sustainabilityMetrics.carbonFootprint < 10) score += 10;
  else if (this.sustainabilityMetrics.carbonFootprint > 20) score -= 15;
  
  // Water footprint impact
  if (this.sustainabilityMetrics.waterFootprint < 10) score += 15;
  else if (this.sustainabilityMetrics.waterFootprint < 50) score += 10;
  else if (this.sustainabilityMetrics.waterFootprint > 100) score -= 10;
  
  // Certification bonuses
  score += this.certifications.length * 5;
  
  // Spoilage rate impact (lower is better)
  if (this.baseSpoilageRate < 2) score += 10;
  else if (this.baseSpoilageRate < 5) score += 5;
  else if (this.baseSpoilageRate > 15) score -= 10;
  
  return Math.max(0, Math.min(100, score));
};

// Pre-save middleware to update green score
productSchema.pre('save', function(next) {
  if (this.isModified('packagingType') || 
      this.isModified('sustainabilityMetrics') || 
      this.isModified('certifications') || 
      this.isModified('baseSpoilageRate')) {
    this.sustainabilityMetrics.greenScore = this.calculateGreenScore();
  }
  next();
});

module.exports = mongoose.model('Product', productSchema); 