import mongoose from "mongoose";
import Package from "../models/Package.js";
import dotenv from "dotenv";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

await Package.insertMany([
  { name: "basic", type: "membership", durationDays: 30, price: 0 },
  { name: "standard", type: "membership", durationDays: 30, price: 199 },
  { name: "pro", type: "membership", durationDays: 30, price: 399 },

  { name: "boost_1_day", type: "boost", durationDays: 1, price: 49 },
  { name: "boost_1_week", type: "boost", durationDays: 7, price: 149 },
  { name: "boost_1_month", type: "boost", durationDays: 30, price: 299 },
]);

console.log("✅ Packages eklendi");
process.exit();
