const nodemailer = require('nodemailer');

// Create reusable transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // e.g. your email address
    pass: process.env.EMAIL_PASS  // your Gmail App Password
  }
});

/**
 * Sends a stylized OTP email to the user
 */
const sendOtpEmail = async (toEmail, otpCode) => {
  const mailOptions = {
    from: '"Swift Royal Investment Bank" <no-reply@swiftroyalbank.com>',
    to: toEmail,
    subject: 'Your Account Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0b3c7b; text-align: center;">Swift Royal Capital Bank</h2>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">
        <p style="font-size: 15px; color: #334155;">Hello,</p>
        <p style="font-size: 15px; color: #334155;">Your one-time security passcode for logging into your account is:</p>
        
        <div style="text-align: center; margin: 25px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #003366; background-color: #f1f5f9; padding: 10px 24px; border-radius: 6px; display: inline-block;">
            ${otpCode}
          </span>
        </div>

        <p style="font-size: 13px; color: #64748b; text-align: center;">This code will expire in 5 minutes. If you did not request this code, please ignore this email.</p>
      </div>
    `
  };

  return await transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail };