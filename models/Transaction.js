// models/Transaction.js
const mongoose = require('mongoose');
const { TRANSACTION_TYPES, TRANSACTION_STATUS, GATEWAYS } = require('../config/constants');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(TRANSACTION_TYPES),
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Transaction amount must be greater than 0']
  },
  currency: {
    type: String,
    default: 'KES',
    uppercase: true
  },
  gateway: {
    type: String,
    enum: Object.values(GATEWAYS),
    default: GATEWAYS.MPESA
  },
  status: {
    type: String,
    enum: Object.values(TRANSACTION_STATUS),
    default: TRANSACTION_STATUS.PENDING,
    index: true
  },
  // Unique payment gateway reference ID (e.g., M-Pesa CheckoutRequestID or Receipt No)
  reference: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  recipientAccountNumber: {
    type: String,
    default: null,
    trim: true
  },
  // Stores raw webhook payload / metadata for auditing
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true 
});

// Index for high-performance transaction queries per user
transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);