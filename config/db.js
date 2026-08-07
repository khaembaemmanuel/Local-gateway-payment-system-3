// config/db.js
const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri);
    console.log(`✅ [Database] Connected to MongoDB: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ [Database Error] ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;