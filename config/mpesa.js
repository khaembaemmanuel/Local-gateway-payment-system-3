// config/mpesa.js
const axios = require('axios');
const env = require('./env');

const BASE_URL = env.mpesa.baseUrl;

/**
 * Fetch OAuth Access Token from Safaricom Daraja API
 * @returns {Promise<string>} Bearer Access Token
 */
const getOAuthToken = async () => {
  const { consumerKey, consumerSecret } = env.mpesa;

  if (!consumerKey || !consumerSecret) {
    throw new Error('[Daraja Error] Consumer Key or Consumer Secret is missing in environment config');
  }

  const authHeader = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get(
      `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${authHeader}` }
      }
    );

    return response.data.access_token;
  } catch (err) {
    console.error('[Daraja OAuth Error]', err.response?.data || err.message);
    throw new Error('Failed to authenticate with Safaricom Daraja API');
  }
};

/**
 * Generate Daraja STK Push Password & YYYYMMDDHHmmss Timestamp
 * @returns {{ password: string, timestamp: string, shortCode: string }}
 */
const generateStkPassword = () => {
  const { shortCode, passkey } = env.mpesa;

  if (!shortCode || !passkey) {
    throw new Error('[Daraja Error] Shortcode or Passkey is missing in environment config');
  }

  const date = new Date();
  const timestamp =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0') +
    String(date.getHours()).padStart(2, '0') +
    String(date.getMinutes()).padStart(2, '0') +
    String(date.getSeconds()).padStart(2, '0');

  const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

  return { password, timestamp, shortCode };
};

/**
 * Format local Kenyan phone numbers to international standard (254XXXXXXXXX)
 * Supports inputs like: 0712345678, 0112345678, +254712345678, 254712345678
 * @param {string} phone 
 * @returns {string} Formatted 12-digit phone number string
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return '';

  // Strip all non-numeric characters
  let cleaned = phone.toString().replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = `254${cleaned.substring(1)}`;
  }

  return cleaned;
};

module.exports = {
  BASE_URL,
  getOAuthToken,
  generateStkPassword,
  formatPhoneNumber
};