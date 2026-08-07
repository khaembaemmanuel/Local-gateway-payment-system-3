const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const connectDB = require('./config/db');

const createAdminAccount = async () => {
  try {
    await connectDB();

    const adminEmail = "admin@ibercapital.com";
    
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('⚠️ Admin account already exists in the database!');
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('AdminSecurePassword123!', salt);

    const adminUser = new User({
      firstName: 'System',
      lastName: 'Admin',
      username: 'admin',
      email: adminEmail,
      password: hashedPassword,
      accountNumber: 'SRCB999999',
      accountType: 'Checking',
      currency: 'USD',
      balance: 0.00,
      status: 'active'
    });

    await adminUser.save();
    console.log('✅ Admin account created successfully!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: AdminSecurePassword123!`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating admin account:', err);
    process.exit(1);
  }
};

createAdminAccount();