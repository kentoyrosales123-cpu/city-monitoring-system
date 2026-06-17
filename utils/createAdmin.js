const bcrypt = require("bcryptjs");
const User = require("../models/User");

const createDefaultAdmin = async () => {
  const adminEmail = "admin@urbanrisk.com";

  const existingAdmin = await User.findOne({ email: adminEmail });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("admin123", 10);

    await User.create({
      name: "System Administrator",
      email: adminEmail,
      password: hashedPassword,
      role: "admin",
      status: "active",
    });

    console.log("Default admin created:");
    console.log("Email: admin@urbanrisk.com");
    console.log("Password: admin123");
  }
};

module.exports = createDefaultAdmin;