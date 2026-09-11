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
    type: Date,
    required: [true, 'Date of birth is required'],
    validate: {
      validator: function (v) {
        if (!v) return false;
        
        const today = new Date();
        const birthDate = new Date(v);
        
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDifference = today.getMonth() - birthDate.getMonth();
        
        if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        // Enforce minimum age requirement of 18 years old
        return age >= 18;
      },
      message: 'You must be at least 18 years old to register an account.'
    }
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
    enum: ['USER', 'ADMIN', 'SUPERADMIN'],
    default: 'USER'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'deactivated'],
    default: 'pending'
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  otp: {
    code: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    isVerified: { type: Boolean, default: false }
  },
  // Password Reset Fields (2-Minute OTP Workflow)
  resetOtp: { 
    type: String, 
    default: null 
  },
  resetOtpExpire: { 
    type: Date, 
    default: null 
  }
}, { 
  timestamps: true 
});

// Security feature: Automatically remove sensitive data hashes whenever user data is sent as JSON
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetOtp;
  delete userObject.resetOtpExpire;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);