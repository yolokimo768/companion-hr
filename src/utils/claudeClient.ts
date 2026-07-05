import Anthropic from "@anthropic-ai/sdk";
import type { HRRecord } from "../types";
import { queryEmployeesToolDefinition, runEmployeeQuery, type EmployeeQueryFilters } from "./employeeQuery";

export const API_KEY_STORAGE_KEY = "companionhr_anthropic_api_key";

export function getStoredApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export interface ClaudeChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_TOOL_ITERATIONS = 5;

export async function askClaude(
  apiKey: string,
  systemPrompt: string,
  history: ClaudeChatMessage[],
  records: HRRecord[]
): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  try {
    const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
    const tools: Anthropic.Tool[] = [queryEmployeesToolDefinition];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response: Anthropic.Message = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1536,
        system: systemPrompt,
        tools,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const textBlock = response.content.find((block) => block.type === "text");
        return textBlock && textBlock.type === "text" ? textBlock.text : "I didn't get a text response back.";
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use" && block.name === queryEmployeesToolDefinition.name) {
          const result = runEmployeeQuery(records, block.input as EmployeeQueryFilters);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }

    return "That question needed more employee lookups than I could complete in one go — try narrowing it a bit.";
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error("That API key was rejected. Double-check it and try again.");
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      throw new Error("This API key doesn't have permission to use this model.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error("Rate limited by the Anthropic API — wait a moment and try again.");
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new Error("Couldn't reach the Anthropic API — check your internet connection.");
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error: ${err.message}`);
    }
    throw new Error("Something went wrong talking to Claude.");
  }
}
