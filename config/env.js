// config/env.js
const dotenv = require('dotenv');
dotenv.config();

const requiredKeys = [
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'DEFAULT_CURRENCY',
  'MPESA_ENV',
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_PASSKEY',
  'MPESA_SHORTCODE',
  'MPESA_CALLBACK_URL'
];

requiredKeys.forEach((key) => {
  if (!process.env[key] || process.env[key] === 'undefined') {
    throw new Error(`[CRITICAL CONFIG ERROR] Missing or invalid required env variable: ${key}`);
  }
});

const mpesaEnv = process.env.MPESA_ENV.toLowerCase();
const mpesaBaseUrl = mpesaEnv === 'production'
  ? 'https://api.safaricom.co.ke'


module.exports = Object.freeze({
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  defaultCurrency: process.env.DEFAULT_CURRENCY,
  mpesa: {
    env: mpesaEnv,
    baseUrl: process.env.DARAJA_BASE_URL || mpesaBaseUrl,
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    passkey: process.env.MPESA_PASSKEY,
    shortCode: process.env.MPESA_SHORTCODE,
    callbackUrl: process.env.MPESA_CALLBACK_URL
  }
});