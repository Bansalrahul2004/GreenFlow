const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  certificationLevel: {
    type: String,
    enum: ['None', 'Basic', 'FairTrade', 'Organic', 'B Corp', 'Carbon Neutral'],
    default: 'None'
  },
  ESGscore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  auditDocs: [{
    name: String,
    url: String,
    type: String, // 'certification', 'audit', 'report'
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    verified: {
      type: Boolean,
      default: false
    }
  }],
  sustainabilityMetrics: {
    carbonFootprint: {
      type: Number,
      default: 0 // kg CO2 per unit
    },
    waterUsage: {
      type: Number,
      default: 0 // liters per unit
    },
    wasteReduction: {
      type: Number,
      default: 0 // percentage
    },
    renewableEnergy: {
      type: Number,
      default: 0 // percentage
    }
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'suspended', 'rejected'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  lastAudit: {
    type: Date
  },
  nextAuditDue: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
supplierSchema.index({ ESGscore: -1 });
supplierSchema.index({ certificationLevel: 1 });
supplierSchema.index({ status: 1 });

// Virtual for ESG score category
supplierSchema.virtual('esgCategory').get(function() {
  if (this.ESGscore >= 80) return 'Excellent';
  if (this.ESGscore >= 60) return 'Good';
  if (this.ESGscore >= 40) return 'Fair';
  return 'Poor';
});

// Method to calculate ESG score
supplierSchema.methods.calculateESGScore = function() {
  let score = 0;
  
  // Certification bonus
  const certScores = {
    'None': 0,
    'Basic': 10,
    'FairTrade': 25,
    'Organic': 30,
    'B Corp': 40,
    'Carbon Neutral': 35
  };
  
  score += certScores[this.certificationLevel] || 0;
  
  // Sustainability metrics
  if (this.sustainabilityMetrics.carbonFootprint < 10) score += 20;
  else if (this.sustainabilityMetrics.carbonFootprint < 25) score += 15;
  else if (this.sustainabilityMetrics.carbonFootprint < 50) score += 10;
  
  if (this.sustainabilityMetrics.wasteReduction > 50) score += 20;
  else if (this.sustainabilityMetrics.wasteReduction > 25) score += 15;
  else if (this.sustainabilityMetrics.wasteReduction > 10) score += 10;
  
  if (this.sustainabilityMetrics.renewableEnergy > 80) score += 20;
  else if (this.sustainabilityMetrics.renewableEnergy > 50) score += 15;
  else if (this.sustainabilityMetrics.renewableEnergy > 20) score += 10;
  
  // Audit verification bonus
  const verifiedDocs = this.auditDocs.filter(doc => doc.verified).length;
  score += Math.min(verifiedDocs * 5, 20);
  
  return Math.min(score, 100);
};

module.exports = mongoose.model('Supplier', supplierSchema); 