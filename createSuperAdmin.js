require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createSuperAdmin() {
  try {
    // Connect to MongoDB Atlas cluster
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas...');

    const superAdminData = {
      firstName: 'Super',
      lastName: 'Admin',
      username: 'superadmin',
      email: 'emmanuelbarasa168@gmail.com', // Change if you want a different email
      password: 'YourSecurePassword123!', // Change to your desired password
      dob: new Date('1995-01-01'), // Must be 18+ based on your schema validation
      accountNumber: 'SA999999', // Unique account number
      role: 'SUPERADMIN',
      currency: 'USD'
    };

    // Check if super admin already exists
    const existingUser = await User.findOne({ email: superAdminData.email });
    if (existingUser) {
      console.log('User with this email already exists. Updating role to SUPERADMIN...');
      existingUser.role = 'SUPERADMIN';
      await existingUser.save();
      console.log('✅ Existing account successfully upgraded to SUPERADMIN!');
      process.exit(0);
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(superAdminData.password, salt);

    // Create new super admin document
    const newSuperAdmin = new User({
      ...superAdminData,
      password: hashedPassword
    });

    await newSuperAdmin.save();
    console.log('✅ Super Admin profile created successfully!');
    console.log(`Email: ${superAdminData.email}`);
    console.log(`Role: SUPERADMIN`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating Super Admin:', err.message);
    process.exit(1);
  }
}

createSuperAdmin();