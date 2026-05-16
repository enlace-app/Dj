import { GoogleGenAI, Type } from "@google/genai";
import { PREDEFINED_LIBRARY } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const analyzeTrack = async (fileName: string) => {
  const prompt = `
    Analyze the following audio file name and estimate its musical key (in Camelot notation, e.g., "8A", "5B") and BPM.
    File name: "${fileName}".
    If you're not sure, provide a plausible estimate based on the file name context.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            key: { type: Type.STRING },
            bpm: { type: Type.NUMBER }
          },
          required: ["key", "bpm"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return { key: "??", bpm: 128 };
  }
};

export const getDJAdvice = async (currentTrack: string, library: string[] = PREDEFINED_LIBRARY) => {
  const prompt = `
    You are a professional DJ Coach. 
    Current track playing: "${currentTrack}".
    Available library: ${library.join(", ")}.
    
    Which track should I play next for a harmonious transition? 
    Consider BPM, energy, and mood. 
    Suggest 1 track from the library provided and give a short (max 15 words) tip on why it works.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestion: { type: Type.STRING },
            tip: { type: Type.STRING }
          },
          required: ["suggestion", "tip"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Advice Error:", error);
    return { suggestion: library[0], tip: "Try starting with this classic loop!" };
  }
};
