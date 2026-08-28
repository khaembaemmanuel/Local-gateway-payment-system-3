const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { BASE_URL, getOAuthToken, formatPhoneNumber } = require('../config/mpesa');
const { TRANSACTION_TYPES, TRANSACTION_STATUS, GATEWAYS } = require('../config/constants');

// ==========================================
// 1. INITIATE M-PESA B2C WITHDRAWAL
// ==========================================
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount, phone } = req.body;
    const userId = req.user.userId;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid withdrawal amount' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user has sufficient balance
    if (user.balance < Number(amount)) {
      return res.status(400).json({ success: false, message: 'Insufficient account balance' });
    }

    const targetPhone = phone || user.phoneNumber;
    if (!targetPhone) {
      return res.status(400).json({ success: false, message: 'Recipient phone number is required' });
    }

    const formattedPhone = formatPhoneNumber(targetPhone);
    const token = await getOAuthToken();

    // Generate a unique tracking reference ID for B2C
    const originatorConversationID = `WD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    // Create a Pending withdrawal transaction record
    const transaction = new Transaction({
      userId,
      amount: Number(amount),
      type: TRANSACTION_TYPES.WITHDRAWAL || 'Withdrawal',
      gateway: GATEWAYS.MPESA || 'M-Pesa',
      status: TRANSACTION_STATUS.PENDING || 'Pending',
      reference: originatorConversationID
    });
    await transaction.save();

    const b2cPayload = {
      InitiatorName: process.env.MPESA_B2C_INITIATOR,
      SecurityCredential: process.env.MPESA_B2C_PASSWORD,
      CommandID: 'BusinessPayment', // Options: BusinessPayment, SalaryPayment, PromotionPayment
      Amount: Math.ceil(Number(amount)),
      PartyA: process.env.MPESA_SHORTCODE,
      PartyB: formattedPhone,
      Remarks: 'Account Withdrawal',
      QueueTimeOutURL: process.env.MPESA_B2C_TIMEOUT_URL,
      ResultURL: process.env.MPESA_B2C_RESULT_URL,
      OriginatorConversationID: originatorConversationID,
      AccountReference: `ACC-${userId.toString().slice(-6)}`
    };

    const response = await axios.post(
      `${BASE_URL}/mpesa/b2c/v1/paymentrequest`,
      b2cPayload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Save conversation ID details to metadata
    transaction.metadata = { conversationID: response.data.ConversationID };
    await transaction.save();

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully. Processing payout...',
      conversationId: response.data.ConversationID
    });

  } catch (err) {
    console.error('B2C Withdrawal Initiation Error:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal request',
      error: err.response?.data || err.message
    });
  }
});

// ==========================================
// 2. B2C RESULT CALLBACK WEBHOOK
// ==========================================
router.post('/b2c-result', async (req, res) => {
  try {
    const resultData = req.body.Result;
    const originatorConversationID = resultData.OriginatorConversationID;
    const resultCode = resultData.ResultCode; // 0 means success

    const transaction = await Transaction.findOne({ reference: originatorConversationID });
    if (!transaction) {
      console.error(`Withdrawal transaction not found for OriginatorConversationID: ${originatorConversationID}`);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    // Prevent duplicate processing if already updated
    if (transaction.status !== (TRANSACTION_STATUS.PENDING || 'Pending')) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (resultCode === 0) {
      // SUCCESS: Money has been successfully sent to the user's phone
      const resultParams = resultData.ResultParameters.ResultParameter;
      const mpesaReceipt = resultParams.find(p => p.Key === 'TransactionReceipt')?.Value;

      transaction.status = TRANSACTION_STATUS.COMPLETED || 'Completed';
      transaction.metadata = {
        ...transaction.metadata,
        mpesaReceiptNumber: mpesaReceipt,
        resultDesc: resultData.ResultDesc
      };
      await transaction.save();

      // Deduct the money from the user's account balance NOW
      await User.findByIdAndUpdate(transaction.userId, {
        $inc: { balance: -transaction.amount }
      });

      console.log(`✅ Withdrawal successful: KES ${transaction.amount} sent (Receipt: ${mpesaReceipt})`);
    } else {
      // FAILED: Safaricom rejected or cancelled the transaction
      transaction.status = TRANSACTION_STATUS.FAILED || 'Failed';
      transaction.metadata = {
        ...transaction.metadata,
        resultDesc: resultData.ResultDesc
      };
      await transaction.save();

      console.log(`❌ Withdrawal failed: ${resultData.ResultDesc}`);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('B2C Callback Error:', err.message);
    res.status(500).json({ success: false, message: 'Callback processing error' });
  }
});

module.exports = router;