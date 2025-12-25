// External imports
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

// Internal imports
const app = require("./app");

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);

  mongoose
    .connect(process.env.DB_CONNECTION_URI)
    .then(() => {
      console.log("Database connected successfully");
    })
    .catch((err) => {
      console.error("MongoDB connection error", err);
    });
});
