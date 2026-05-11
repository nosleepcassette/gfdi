import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import type { Adapter, AdapterOptions, Message } from "./index";

/**
 * Claude Code stores sessions as JSONL files at:
 *   ~/.claude/projects/<project-path>/<session-uuid>.jsonl
 *
 * Each line is a JSON object. User messages have:
 *   { "type": "human", "message": { "content": [...] } }
 * or sometimes:
 *   { "role": "user", "content": "..." }
 */

const CLAUDE_DIR = join(homedir(), ".claude", "projects");
const CLAUDE_HISTORY = join(homedir(), ".claude", "history.jsonl");

export function claudeAdapter(): Adapter {
  return {
    name: "claude",
    async *messages(options?: AdapterOptions): AsyncGenerator<Message> {
      const files = await collectClaudeJsonlFiles(CLAUDE_DIR);
      const canonicalSessionIds = new Set(files.map((file) => basename(file, ".jsonl")));

      for (const filePath of files) {
        const rel = relative(CLAUDE_DIR, filePath);
        const [project = "unknown"] = rel.split("/");

        yield* parseClaudeJsonl(filePath, {
          session: sessionNameFor(filePath),
          project,
          since: options?.since,
        });
      }

      yield* parseClaudeHistory(CLAUDE_HISTORY, canonicalSessionIds, options);
    },
  };
}

async function collectClaudeJsonlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(current);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry);
      let entryStat;
      try {
        entryStat = await stat(fullPath);
      } catch {
        continue;
      }

      if (entryStat.isDirectory()) {
        await walk(fullPath);
      } else if (entry.endsWith(".jsonl")) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files.sort();
}

function sessionNameFor(filePath: string): string {
  const fileSession = basename(filePath, ".jsonl");
  const parent = basename(dirname(filePath));
  if (parent === "subagents") {
    return `${basename(dirname(dirname(filePath)))}/${fileSession}`;
  }
  return fileSession;
}

async function* parseClaudeJsonl(
  filePath: string,
  context: { session: string; project: string; since?: Date },
): AsyncGenerator<Message> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      const text = extractUserText(entry);
      if (!text) {
        continue;
      }

      const timestamp = extractTimestamp(entry);
      if (context.since && timestamp) {
        const ts = new Date(timestamp);
        if (ts < context.since) {
          continue;
        }
      }

      yield {
        text,
        timestamp: timestamp ?? undefined,
        session: context.session,
        project: context.project,
        source: "projects",
      };
    } catch {
      // Skip malformed lines
    }
  }
}

async function* parseClaudeHistory(
  filePath: string,
  canonicalSessionIds: Set<string>,
  options?: AdapterOptions,
): AsyncGenerator<Message> {
  try {
    await stat(filePath);
  } catch {
    return;
  }

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    try {
      const entry = JSON.parse(line) as ClaudeHistoryEntry;
      const sessionId = typeof entry.sessionId === "string" ? entry.sessionId : undefined;
      if (sessionId && canonicalSessionIds.has(sessionId)) {
        continue;
      }

      const text = typeof entry.display === "string" ? entry.display.trim() : "";
      if (!text) {
        continue;
      }

      if (options?.since && entry.timestamp) {
        const ts = new Date(entry.timestamp);
        if (ts < options.since) {
          continue;
        }
      }

      yield {
        text,
        timestamp: entry.timestamp,
        session: sessionId,
        project: entry.project,
        source: "history",
      };
    } catch {
      // Skip malformed lines
    }
  }
}

function extractUserText(entry: Record<string, unknown>): string | null {
  // Format: { "type": "user", "message": { "role": "user", "content": "..." } }
  if (entry["type"] === "user") {
    const message = entry["message"] as Record<string, unknown> | undefined;
    if (!message) {
      return null;
    }
    return contentToString(message["content"]);
  }

  // Legacy format: { "type": "human", "message": { "content": [...] } }
  if (entry["type"] === "human") {
    const message = entry["message"] as Record<string, unknown> | undefined;
    if (!message) {
      return null;
    }
    return contentToString(message["content"]);
  }

  // Flat format: { "role": "user", "content": "..." }
  if (entry["role"] === "user") {
    return contentToString(entry["content"]);
  }

  return null;
}

function contentToString(content: unknown): string | null {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (typeof part !== "object" || part === null) {
          return null;
        }

        const candidate = part as { type?: string; text?: unknown; content?: unknown };
        if (candidate.type === "tool_result") {
          return null;
        }
        if (typeof candidate.text === "string") {
          return candidate.text;
        }
        if (typeof candidate.content === "string") {
          return candidate.content;
        }
        return null;
      })
      .filter((part): part is string => typeof part === "string" && part.length > 0);
    return parts.length > 0 ? parts.join(" ") : null;
  }
  return null;
}

function extractTimestamp(entry: Record<string, unknown>): string | null {
  if (typeof entry["timestamp"] === "string") {
    return entry["timestamp"];
  }
  if (typeof entry["createdAt"] === "string") {
    return entry["createdAt"];
  }
  return null;
}

interface ClaudeHistoryEntry {
  display?: string;
  project?: string;
  sessionId?: string;
  timestamp?: string;
}
