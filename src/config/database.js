import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

let databaseReady = false;

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });
  databaseReady = true;
  console.log("MongoDB connected");
}

export function isDatabaseReady() {
  return databaseReady && mongoose.connection.readyState === 1;
}
