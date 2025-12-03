// AI features have been disabled.
// This file is kept as a placeholder to prevent build errors if referenced elsewhere.

import { ScriptNode } from "../types";

export const generateScriptSuggestion = async (
  currentNode: ScriptNode,
  previousContext: string
): Promise<{ text: string; choices?: string[] }> => {
  return { text: "AI Assistant is disabled." };
};
