const mongoose = require('mongoose');
const env = require('./env');

// Enforce strict query mode for consistent data filtering
mongoose.set('strictQuery', true);

const connectDB = async () => {
    try {
        // Production connection options
        const options = {
            serverSelectionTimeoutMS: 5000, 
            socketTimeoutMS: 45000,          
        };

        const conn = await mongoose.connect(env.mongoUri, options);
        console.log(`✅ [Database] Connected to MongoDB: ${conn.connection.host}`);

        // Listen for runtime connection events (critical for cloud monitoring)
        mongoose.connection.on('error', (err) => {
            console.error(`❌ [Database Runtime Error]: ${err.message}`);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ [Database Warning] Lost connection to MongoDB. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('🔄 [Database] Successfully reconnected to MongoDB.');
        });

    } catch (err) {
        console.error(`❌ [Database Connection Error]: ${err.message}`);
        // Throw the error so server.js catches it and safely terminates startup
        throw err;
    }
};

module.exports = connectDB;