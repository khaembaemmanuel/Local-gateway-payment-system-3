const axios = require('axios');

const verifyRecaptcha = async (req, res, next) => {
    // Expect the reCAPTCHA token from the frontend form submission
    const recaptchaToken = req.body['g-recaptcha-response'] || req.headers['x-recaptcha-token'];

    if (!recaptchaToken) {
        return res.status(400).json({ 
            success: false, 
            message: 'Security verification token missing. Please complete the reCAPTCHA.' 
        });
    }

    try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY; // Store your secret key securely in environment variables
        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;

        const response = await axios.post(verificationUrl);
        const { success, score } = response.data;

        if (!success) {
            return res.status(403).json({ 
                success: false, 
                message: 'Security verification failed. Please try again.' 
            });
        }

        // Optional: If you are using reCAPTCHA v3, you can also check the score threshold here (e.g., score >= 0.5)

        // Token is valid, proceed to the actual route handler
        next();
    } catch (error) {
        console.error('reCAPTCHA verification error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error during security verification.' 
        });
    }
};

module.exports = verifyRecaptcha;