const mongoose = require('mongoose');

const wasteAlertSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  region: {
    type: String,
    required: true,
    trim: true
  },
  storeId: {
    type: String,
    trim: true
  },
  predictedWasteQty: {
    type: Number,
    required: true,
    min: 0
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0
  },
  predictedWastePercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 75
  },
  factors: [{
    name: String,
    impact: Number, // positive or negative impact on waste prediction
    description: String
  }],
  recommendations: [{
    action: String,
    impact: String, // 'high', 'medium', 'low'
    description: String,
    estimatedSavings: Number // in currency or percentage
  }],
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'dismissed'],
    default: 'active'
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  },
  resolutionNotes: {
    type: String,
    trim: true
  },
  alertDate: {
    type: Date,
    default: Date.now
  },
  predictedDate: {
    type: Date,
    required: true
  },
  actualWasteQty: {
    type: Number,
    min: 0
  },
  accuracy: {
    type: Number,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
wasteAlertSchema.index({ productId: 1 });
wasteAlertSchema.index({ supplierId: 1 });
wasteAlertSchema.index({ riskLevel: 1 });
wasteAlertSchema.index({ status: 1 });
wasteAlertSchema.index({ alertDate: -1 });
wasteAlertSchema.index({ predictedDate: 1 });

// Virtual for alert age
wasteAlertSchema.virtual('alertAge').get(function() {
  return Math.floor((new Date() - this.alertDate) / (1000 * 60 * 60 * 24)); // days
});

// Virtual for urgency
wasteAlertSchema.virtual('urgency').get(function() {
  const daysUntilPredicted = Math.floor((this.predictedDate - new Date()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilPredicted <= 1) return 'immediate';
  if (daysUntilPredicted <= 3) return 'urgent';
  if (daysUntilPredicted <= 7) return 'high';
  return 'normal';
});

// Virtual for potential savings
wasteAlertSchema.virtual('potentialSavings').get(function() {
  // This would need to be calculated based on product price and waste quantity
  return this.predictedWasteQty * 10; // Placeholder calculation
});

// Method to calculate risk level
wasteAlertSchema.methods.calculateRiskLevel = function() {
  const wastePercentage = this.predictedWastePercentage;
  const confidence = this.confidence;
  
  // High confidence predictions are weighted more heavily
  const adjustedRisk = wastePercentage * (confidence / 100);
  
  if (adjustedRisk >= 30) return 'critical';
  if (adjustedRisk >= 20) return 'high';
  if (adjustedRisk >= 10) return 'medium';
  return 'low';
};

// Method to generate recommendations
wasteAlertSchema.methods.generateRecommendations = function() {
  const recommendations = [];
  
  if (this.predictedWastePercentage > 20) {
    recommendations.push({
      action: 'Discount Pricing',
      impact: 'high',
      description: 'Implement 20-30% discount to increase sales velocity',
      estimatedSavings: this.predictedWasteQty * 5
    });
  }
  
  if (this.currentStock > this.predictedWasteQty * 2) {
    recommendations.push({
      action: 'Transfer to Other Stores',
      impact: 'medium',
      description: 'Transfer excess inventory to stores with higher demand',
      estimatedSavings: this.predictedWasteQty * 3
    });
  }
  
  if (this.predictedWastePercentage > 15) {
    recommendations.push({
      action: 'Promotional Campaign',
      impact: 'medium',
      description: 'Launch targeted marketing campaign to boost sales',
      estimatedSavings: this.predictedWasteQty * 4
    });
  }
  
  return recommendations;
};

// Pre-save middleware to calculate risk level and recommendations
wasteAlertSchema.pre('save', function(next) {
  if (this.isModified('predictedWastePercentage') || this.isModified('confidence')) {
    this.riskLevel = this.calculateRiskLevel();
  }
  
  if (this.isModified('predictedWastePercentage') || this.isModified('currentStock')) {
    this.recommendations = this.generateRecommendations();
  }
  
  next();
});

module.exports = mongoose.model('WasteAlert', wasteAlertSchema); 