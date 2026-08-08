// middleware/errorHandler.js
const env = require('../config/env');

const errorHandler = (err, req, res, next) => {
    // Default to 500 server error if no status code is set
    let statusCode = err.statusCode || res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message || 'Internal Server Error';

    // Handle Mongoose Bad ObjectId (CastError)
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Resource not found. Invalid ${err.path}: ${err.value}`;
    }

    // Handle Mongoose Duplicate Key Error
    if (err.code === 11000) {
        statusCode = 400;
        const field = Object.keys(err.keyValue || {})[0] || 'Field';
        message = `Duplicate value entered for ${field}. Please use another value.`;
    }

    // Handle Mongoose Validation Errors
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    // Log the error internally for server-side monitoring
    console.error(`❌ [Error Caught]: ${err.message}`, {
        path: req.originalUrl,
        method: req.method,
        stack: env.nodeEnv === 'development' ? err.stack : undefined
    });

    // Send the response safely
    res.status(statusCode).json({
        success: false,
        message: message,
        // Only include the stack trace if we are in development mode
        ...(env.nodeEnv === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;