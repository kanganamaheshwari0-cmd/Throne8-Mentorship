const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");
const Mentor = require("./models/Mentor");

const createMentor = async () => {
try {
if (!process.env.MONGO_URI) {
throw new Error("MONGO_URI is missing in .env");
}

const name = process.env.MENTOR_NAME;
const email = process.env.MENTOR_EMAIL?.trim().toLowerCase();
const password = process.env.MENTOR_PASSWORD;
const sessionPricePaise = Number(process.env.MENTOR_SESSION_PRICE_PAISE);

if (!name || !email || !password || password.length < 8) {
  throw new Error(
    "Set MENTOR_NAME, MENTOR_EMAIL and a password of at least 8 characters in .env"
  );
}

if (
  !Number.isSafeInteger(sessionPricePaise) ||
  sessionPricePaise < 1
) {
  throw new Error(
    "MENTOR_SESSION_PRICE_PAISE must be a positive integer"
  );
}

await mongoose.connect(process.env.MONGO_URI);

const existingUser = await User.findOne({ email }).select("+password");

if (existingUser && existingUser.role !== "mentor") {
  throw new Error(
    "This email already belongs to a non-mentor account. Use a different email."
  );
}

let user = existingUser;

if (!user) {
  const hashedPassword = await bcrypt.hash(password, 12);

  user = await User.create({
    name: name.trim(),
    email,
    password: hashedPassword,
    role: "mentor",
    isActive: true,
  });

  console.log("Mentor user created.");
} else {
  console.log("Mentor user already exists; keeping existing account.");
}

let mentor = await Mentor.findOne({ userId: user._id });

if (!mentor) {
  mentor = await Mentor.create({
    userId: user._id,
    expertise: [],
    sessionPricePaise,
    isVerified: false,
  });

  console.log("Mentor profile created.");
} else {
  console.log("Mentor profile already exists; no duplicate created.");
}

console.log("Mentor setup completed.");
console.log("Email:", user.email);
console.log("Role:", user.role);
console.log("Verified:", mentor.isVerified);

} catch (error) {
console.error("Mentor setup failed:", error.message);
process.exitCode = 1;
} finally {
await mongoose.disconnect().catch(() => {});
}
};

createMentor();
