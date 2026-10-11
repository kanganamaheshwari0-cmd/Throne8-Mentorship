
require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing in .env file");
    process.exit(1);
  }

  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
};

startServer();