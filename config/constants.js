const ROLES = Object.freeze({
  USER: 'USER',
  ADMIN: 'ADMIN'
});
const TRANSACTION_TYPES = Object.freeze({
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  TRANSFER: 'Transfer'
});

const TRANSACTION_STATUS = Object.freeze({
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed'
});

const GATEWAYS = Object.freeze({
  MPESA: 'M-Pesa',
  PAYPAL: 'PayPal',
  SYSTEM: 'System'
});

module.exports = {
  ROLES,
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
  GATEWAYS
};