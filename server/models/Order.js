const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerEmail: { type: String, required: true },
  preferences: {
    minimalPackaging: { type: Boolean, default: false },
    greenDelivery: { type: Boolean, default: false },
    carbonOffset: { type: Boolean, default: false },
    localSourcing: { type: Boolean, default: false },
    bulkOrdering: { type: Boolean, default: false }
  },
  items: [{
    name: String,
    quantity: Number,
    price: Number
  }],
  totalAmount: { type: Number, required: true },
  ecoImpact: {
    carbonSaved: Number,
    wasteReduced: Number,
    costSavings: Number,
    ecoScore: Number
  },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema); 