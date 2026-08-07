// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { 
    type: String, 
    required: true, 
    trim: true 
  },
  lastName: { 
    type: String, 
    required: true, 
    trim: true 
  },
  username: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  country: { 
    type: String, 
    trim: true 
  },
  phoneNumber: { 
    type: String, 
    required: false, 
    sparse: true,
    trim: true 
  },
  gender: { 
    type: String, 
    enum: ['Male', 'Female', 'Other'] 
  },
  dob: { 
    type: Date 
  },
  address: { 
    type: String, 
    trim: true 
  },
  accountNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  accountType: { 
    type: String, 
    enum: ['Savings', 'Checking', 'Business'], 
    default: 'Savings' 
  },
  currency: { 
    type: String, 
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'KES']
  },
  balance: { 
    type: Number, 
    default: 0.00, 
    min: [0, 'Balance cannot be negative'] 
  },
  role: { 
    type: String, 
    enum: ['USER', 'ADMIN'], 
    default: 'USER' 
  },
  otp: {
    code: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    isVerified: { type: Boolean, default: false }
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('User', userSchema);