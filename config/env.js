// config/env.js
const dotenv = require('dotenv');
dotenv.config();

const requiredKeys = [
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'DEFAULT_CURRENCY'
];

requiredKeys.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`[CRITICAL CONFIG ERROR] Missing required env variable: ${key}`);
  }
});

module.exports = Object.freeze({
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  defaultCurrency: process.env.DEFAULT_CURRENCY,
  mpesa: {
    env: process.env.MPESA_ENV,
    baseUrl: process.env.DARAJA_BASE_URL,
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    passkey: process.env.MPESA_PASSKEY,
    shortCode: process.env.MPESA_SHORTCODE,
    callbackUrl: process.env.MPESA_CALLBACK_URL
  }
});