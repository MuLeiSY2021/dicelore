import type { DB } from "../store/db.js";
import type { ToolDef } from "./tooldef.js";
import { successEnvelope, errorEnvelope, type CallToolResult } from "./envelope.js";
import { remindersFor } from "./reminders.js";

export function runTool(db: DB, tool: ToolDef, rawInput: unknown): CallToolResult {
  try {
    const input = tool.inputSchema.parse(rawInput); // 防御 + 脱 SDK 单测;ZodError 走错误信封(INTERNAL)
    const out = tool.handler(db, input);
    const reminders = remindersFor(tool.name, out, input);
    const sc = reminders.length ? { ...out, reminders } : out; // reminders 进 structuredContent(流③、只回 AI)
    return successEnvelope(out, sc);
  } catch (e) {
    return errorEnvelope(e); // 含 ZodError → classify 归 INTERNAL
  }
}
