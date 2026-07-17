import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
async function run() {
  const embedRes = await ai.models.embedContent({
    model: "gemini-embedding-2-preview",
    contents: "Hello world"
  });
  console.log(JSON.stringify(embedRes));
}
run();
