
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import { connectDB } from "./config/db.js";
import TestRecord from "./models/TestRecord.js";
import { generateAIResponse } from "./services/gemini.service.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

let dbConnected = false;

// Basic server test
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "WTQ AI Boilerplate is running",
  });
});

// MongoDB test
app.get("/api/test/db", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      dbConnected = await connectDB();
    }

    if (!dbConnected || mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "MongoDB is not connected",
      });
    }

    await mongoose.connection.db.admin().ping();

    return res.json({
      success: true,
      message: "MongoDB connection and ping successful",
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: error.message,
    });
  }
});

// Gemini test with automatic fallback
app.post("/api/test/gemini", async (req, res) => {
  try {
    const prompt = "Reply with exactly: Gemini API working";

    const result = await generateAIResponse(prompt);

    return res.json({
      success: true,
      message: "Gemini API working",
      model: result.model,
      response: result.text,
    });
  } catch (error) {
    console.error("Gemini test failed:", error.message);

    return res.status(502).json({
      success: false,
      message: error.message,
    });
  }
});

// Combined test: Gemini + MongoDB save
app.post("/api/test/full", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      dbConnected = await connectDB();
    }

    if (!dbConnected || mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "MongoDB connection failed. Check MONGO_URI.",
      });
    }

    const prompt =
      typeof req.body.prompt === "string" && req.body.prompt.trim()
        ? req.body.prompt.trim()
        : "Suggest one useful AI application idea for Pakistan in two sentences.";

    // The service tries the primary model and configured fallbacks.
    const result = await generateAIResponse(prompt);

    const savedRecord = await TestRecord.create({
      task: "hackathon-boilerplate-test",
      prompt,
      response: result.text,
    });

    return res.json({
      success: true,
      message: "Gemini tested and response saved to MongoDB",
      model: result.model,
      data: savedRecord,
    });
  } catch (error) {
    console.error("Full test failed:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Start server
const startServer = async () => {
  dbConnected = await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(
      `MongoDB status: ${dbConnected ? "Connected" : "Unavailable"}`
    );
    console.log(
      `Gemini key configured: ${Boolean(process.env.GEMINI_API_KEY)}`
    );
    console.log(
      `Gemini primary model: ${process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"}`
    );
    console.log(
      `Gemini fallback models: ${process.env.GEMINI_FALLBACK_MODELS || "None configured"}`
    );
  });
};

startServer();

