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
    enum: Object.values(TRANSACTION_TYPES || {}),
    default: 'DEPOSIT'
  },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Amount must be greater than 0']
  },
  currency: {
    type: String,
    default: 'KES',
    uppercase: true
  },
  amountUSD: {
    type: Number,
    required: true,
    default: 0
  },
  exchangeRate: {
    type: Number,
    required: true,
    default: 1
  },
  gateway: {
    type: String,
    default: GATEWAYS ? GATEWAYS.MPESA : 'MPesa'
  },
  status: {
    type: String,
    default: 'Completed',
    index: true
  },
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
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true 
});

transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);