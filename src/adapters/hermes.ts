import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import type { Adapter, AdapterOptions, Message } from "./index";

const HERMES_DIR = join(homedir(), ".hermes");
const HERMES_SESSIONS_DIR = join(HERMES_DIR, "sessions");
const HERMES_PROFILES_DIR = join(HERMES_DIR, "profiles");

export function hermesAdapter(): Adapter {
  return {
    name: "hermes",
    async *messages(options?: AdapterOptions): AsyncGenerator<Message> {
      yield* walkHermesSessions(HERMES_SESSIONS_DIR, options);
      yield* readHermesProfileHistories(options);
    },
  };
}

async function* walkHermesSessions(
  dir: string,
  options?: AdapterOptions,
): AsyncGenerator<Message> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    let entryStat;
    try {
      entryStat = await stat(fullPath);
    } catch {
      continue;
    }

    if (entryStat.isDirectory()) {
      yield* walkHermesSessions(fullPath, options);
    } else if (entry.endsWith(".jsonl")) {
      yield* parseHermesJsonl(fullPath, {
        session: entry.replace(".jsonl", ""),
        since: options?.since,
      });
    }
  }
}

async function* parseHermesJsonl(
  filePath: string,
  context: { session: string; since?: Date },
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
      const entry = JSON.parse(line) as HermesJsonlEntry;
      if (entry.role !== "user") {
        continue;
      }

      const text = extractText(entry.content);
      if (!text || shouldSkipInjectedContext(text)) {
        continue;
      }

      if (context.since && entry.timestamp) {
        const ts = new Date(entry.timestamp);
        if (ts < context.since) {
          continue;
        }
      }

      yield {
        text,
        timestamp: entry.timestamp,
        session: context.session,
        agent: "hermes",
      };
    } catch {
      // Skip malformed lines.
    }
  }
}

async function* readHermesProfileHistories(
  options?: AdapterOptions,
): AsyncGenerator<Message> {
  let profiles: string[];
  try {
    profiles = await readdir(HERMES_PROFILES_DIR);
  } catch {
    return;
  }

  for (const profile of profiles) {
    const profileDir = join(HERMES_PROFILES_DIR, profile);
    const historyPath = join(profileDir, ".hermes_history");

    try {
      const profileStat = await stat(profileDir);
      if (!profileStat.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    yield* parseHermesHistory(historyPath, profile, options);
  }
}

async function* parseHermesHistory(
  filePath: string,
  profile: string,
  options?: AdapterOptions,
): AsyncGenerator<Message> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return;
  }

  let timestamp: string | undefined;

  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("# ")) {
      timestamp = normalizeHistoryTimestamp(line.slice(2));
      continue;
    }

    if (!line.startsWith("+")) {
      continue;
    }

    const text = line.slice(1).trim();
    if (!text || shouldSkipInjectedContext(text)) {
      continue;
    }

    if (options?.since && timestamp) {
      const ts = new Date(timestamp);
      if (ts < options.since) {
        continue;
      }
    }

    yield {
      text,
      timestamp,
      session: basename(filePath),
      agent: `hermes:${profile}`,
    };
  }
}

function extractText(content: unknown): string | null {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return null;
  }

  const parts = content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (typeof part !== "object" || part === null) {
        return null;
      }

      const candidate = part as { text?: unknown; content?: unknown };
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

function normalizeHistoryTimestamp(value: string): string | undefined {
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d+))?$/.exec(
    trimmed,
  );

  if (!match) {
    return trimmed || undefined;
  }

  const [, date, time, fractional = ""] = match;
  const millis = fractional.padEnd(3, "0").slice(0, 3);
  return `${date}T${time}.${millis}`;
}

function shouldSkipInjectedContext(text: string): boolean {
  return (
    text.startsWith("<environment_context>") ||
    text.startsWith("<permissions instructions>")
  );
}

interface HermesJsonlEntry {
  role?: string;
  content?: unknown;
  timestamp?: string;
}
