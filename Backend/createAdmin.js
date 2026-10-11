const mongoose = require("mongoose");
require("dotenv").config();

const bcrypt = require("bcryptjs");
const User = require("./models/User");

const createAdmin = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env");
    }

    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required in .env");
    }

    if (process.env.ADMIN_PASSWORD.length < 12) {
      throw new Error("ADMIN_PASSWORD must be at least 12 characters");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();

    let user = await User.findOne({ email }).select("+password");

    if (user) {
      if (user.role !== "admin") {
        throw new Error(
          "This email already belongs to a non-admin account. Use a separate admin email."
        );
      }

      console.log("Admin account already exists:", user.email);
    } else {
      const hashedPassword = await bcrypt.hash(
        process.env.ADMIN_PASSWORD,
        12
      );

      user = await User.create({
        name: "Platform Admin",
        email,
        password: hashedPassword,
        role: "admin",
        isActive: true,
      });

      console.log("Admin account created:", user.email);
    }
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();