// routes/payment.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { BASE_URL, getOAuthToken, generateStkPassword, formatPhoneNumber } = require('../config/mpesa');

// ==========================================
// 1. INITIATE MPESA STK PUSH
// ==========================================
router.post('/stk-push', auth, async (req, res) => {
  try {
    const rawAmount = req.body.amount || req.body.amountLocal;
    const { phone, currency = 'USD' } = req.body;

    if (!rawAmount || rawAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid amount' });
    }

    const user = await User.findById(req.user.userId);
    const targetPhone = phone || user?.phoneNumber;

    if (!targetPhone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    let finalKesAmount = Number(rawAmount);

    // Convert to KES if the incoming amount is denominated in USD
    if (currency.toUpperCase() === 'USD') {
      try {
        const fxResponse = await axios.get('https://open.er-api.com/v6/latest/USD');
        const rateToKes = fxResponse.data?.rates?.KES;
        
        if (rateToKes) {
          finalKesAmount = parseFloat(rawAmount) * rateToKes;
        } else {
          throw new Error('KES exchange rate unavailable');
        }
      } catch (fxErr) {
        console.error('FX Conversion Error, utilizing fallback rate:', fxErr.message);
        const fallbackRate = 130; // Fallback conversion rate if the external FX service fails
        finalKesAmount = parseFloat(rawAmount) * fallbackRate;
      }
    }

    const formattedPhone = formatPhoneNumber(targetPhone);
    const token = await getOAuthToken();
    const { password, timestamp, shortCode } = generateStkPassword();

    // Create a pending transaction storing the equivalent converted KES value
    const transaction = new Transaction({
      userId: req.user.userId,
      amount: Math.ceil(finalKesAmount),
      type: 'Deposit',
      gateway: 'M-Pesa',
      status: 'Pending'
    });
    await transaction.save();

    const stkPayload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(finalKesAmount),
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: `ACC-${req.user.userId.toString().slice(-6)}`,
      TransactionDesc: 'Deposit'
    };

    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      stkPayload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Save CheckoutRequestID and metadata onto transaction
    transaction.reference = response.data.CheckoutRequestID;
    transaction.metadata = { merchantRequestId: response.data.MerchantRequestID };
    await transaction.save();

    res.json({
      success: true,
      message: 'STK Push initiated successfully',
      checkoutRequestId: response.data.CheckoutRequestID,
      customerMessage: response.data.CustomerMessage
    });

  } catch (err) {
    console.error('STK Push Error:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment request',
      error: err.response?.data || err.message
    });
  }
});

// ==========================================
// 2. DYNAMIC M-PESA CALLBACK WEBHOOK
// ==========================================
router.post('/callback', async (req, res) => {
  try {
    const { Body } = req.body;
    const stkCallback = Body.stkCallback;
    const checkoutRequestId = stkCallback.CheckoutRequestID;

    const transaction = await Transaction.findOne({ reference: checkoutRequestId });
    if (!transaction) {
      console.error(`Transaction not found for CheckoutRequestID: ${checkoutRequestId}`);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (stkCallback.ResultCode === 0) {
      const metadata = stkCallback.CallbackMetadata.Item;
      const mpesaReceipt = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;

      transaction.status = 'Completed';
      transaction.metadata = { 
        ...transaction.metadata, 
        mpesaReceiptNumber: mpesaReceipt,
        resultDesc: stkCallback.ResultDesc 
      };
      await transaction.save();

      // Atomically update user balance
      await User.findByIdAndUpdate(transaction.userId, {
        $inc: { balance: transaction.amount }
      });

      console.log(`✅ Account credited with KES ${transaction.amount} (Receipt: ${mpesaReceipt})`);
    } else {
      transaction.status = 'Failed';
      transaction.metadata = { 
        ...transaction.metadata, 
        resultDesc: stkCallback.ResultDesc 
      };
      await transaction.save();

      console.log(`❌ Payment failed: ${stkCallback.ResultDesc}`);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('Callback Handler Error:', err.message);
    res.status(500).json({ success: false, message: 'Callback processing error' });
  }
});

module.exports = router;