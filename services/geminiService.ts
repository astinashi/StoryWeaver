import { GoogleGenAI } from "@google/genai";
import { ScriptNode, NodeType } from "../types";

const SYSTEM_INSTRUCTION = `You are a creative writing assistant for a Visual Novel game. 
Your task is to help the user generate dialogue, plot twists, or choice options based on the context provided.
Output valid JSON only.`;

export const generateScriptSuggestion = async (
  currentNode: ScriptNode,
  previousContext: string
): Promise<{ text: string; choices?: string[] }> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      Context so far: "${previousContext}"
      Current Character: "${currentNode.character}"
      Current Node Type: "${currentNode.type}"
      
      Task:
      ${currentNode.type === NodeType.CHOICE 
        ? "Suggest 3 interesting choice options for the player that lead to different narrative branches." 
        : "Write a continuation of the dialogue or a description for the current scene. Keep it engaging."}

      Respond with this JSON structure:
      {
        "text": "Suggested dialogue or scene description",
        "choices": ["Option 1", "Option 2", "Option 3"] (only if type is CHOICE)
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return { text: "No response generated." };

    return JSON.parse(text);

  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "Error connecting to AI assistant." };
  }
};