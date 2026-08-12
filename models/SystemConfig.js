
const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  // Use a single document pattern for global settings
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  allowedCurrencies: {
    type: [String],
    default: ['USD', 'EUR', 'GBP', 'KES']
  },
  transferFeePercentage: {
    type: Number,
    default: 0.00,
    min: [0, 'Fee cannot be negative']
  },
  maxDailyWithdrawal: {
    type: Number,
    default: 100000.00
  }
}, { 
  timestamps: true 
});

systemConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

module.exports = mongoose.model('SystemConfig', systemConfigSchema);