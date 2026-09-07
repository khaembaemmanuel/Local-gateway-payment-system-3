// models/WithdrawalRequest.js
const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amountUSD: {
    type: Number,
    required: true
  },
  payoutAmountLocal: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    uppercase: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  referenceCode: {
    type: String,
    trim: true,
    default: null
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Rejected'],
    default: 'Pending',
    index: true
  }
}, {
  timestamps: true
});

withdrawalRequestSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);