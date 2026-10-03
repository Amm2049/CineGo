// src/lib/gemini.ts
// Google Gemini LLM API client singleton using @google/genai SDK

import { GoogleGenAI } from "@google/genai";

const apiKey =
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  "";

// Initialize client only if API key is provided
export const geminiClient = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const GEMINI_MODEL = "gemini-3.8-flash";
