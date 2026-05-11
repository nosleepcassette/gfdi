import { allAdapters, createAdapter } from "../adapters/index";
import { detect } from "../detector/index";
import { renderScanResult } from "../tui/render";
import { createSpinner } from "../tui/spinner";
import type { AgentStats, RenderOptions, ScanResult, WordStats } from "../tui/types";

interface ScanOptions extends RenderOptions {
  agent?: string;
  since?: Date;
}

function parseArgs(args: string[]): ScanOptions {
  const options: ScanOptions = {
    logo: true,
    top: 10,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--agent" || arg === "-a") {
      options.agent = args[++i];
    } else if (arg === "--since" || arg === "-s") {
      const val = args[++i];
      if (val) {
        options.since = new Date(val);
        if (isNaN(options.since.getTime())) {
          console.error(`invalid date: ${val}`);
          process.exit(1);
        }
      }
    } else if (arg === "--json") {
      options.json = true;
      options.plain = true;
    } else if (arg === "--plain") {
      options.plain = true;
    } else if (arg === "--tui") {
      options.tui = true;
      options.plain = false;
    } else if (arg === "--no-logo") {
      options.logo = false;
    } else if (arg === "--logo") {
      options.logoPath = args[++i];
    } else if (arg === "--top") {
      const val = Number(args[++i]);
      if (!Number.isInteger(val) || val < 1) {
        console.error(`invalid --top value: ${args[i]}`);
        process.exit(1);
      }
      options.top = val;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`gfdi scan - scan sessions for profanity

Options:
  --agent, -a <name>   Scan one adapter or logical agent
                       (claude, codex, opencode, amp, cline, hermes, hermes:wizard, pi, zed)
  --since, -s <date>   Only scan messages after this date (ISO 8601)
  --top <n>            Number of top word groups to show (default: 10)
  --logo <path>        Read ASCII logo from a file
  --no-logo            Hide the logo
  --plain              Render plain text
  --json               Render machine-readable JSON
  --tui                Force styled dashboard output even outside a TTY
  --help, -h           Show this help`);
      process.exit(0);
    }
  }

  return options;
}

export async function scan(args: string[]): Promise<void> {
  const options = parseArgs(args);
  const result = await collectScan(options);
  renderScanResult(result, options);
}

async function collectScan(options: ScanOptions): Promise<ScanResult> {
  const started = Date.now();
  const adapters = options.agent
    ? [createAdapter(adapterNameFor(options.agent))]
    : allAdapters();
  const spinner = createSpinner({
    enabled: Boolean(!options.json && !options.plain && !options.tui && process.stdout.isTTY),
  });

  spinner.start("discover");

  const groupTally: Record<string, number> = {};
  const variantTally: Record<string, Record<string, number>> = {};
  const perAgent: Record<string, { messages: number; swears: number }> = {};
  const sourceTally: Record<string, number> = {};

  let totalMessages = 0;
  let totalSwears = 0;

  for (const adapter of adapters) {
    spinner.setAdapter(adapter.name);

    for await (const message of adapter.messages({ since: options.since })) {
      const agentName = message.agent ?? adapter.name;
      if (options.agent && options.agent.includes(":") && agentName !== options.agent) {
        continue;
      }

      const agentStats = (perAgent[agentName] ??= { messages: 0, swears: 0 });
      const sourceName = `${agentName}:${message.source ?? "sessions"}`;

      totalMessages++;
      agentStats.messages++;
      sourceTally[sourceName] = (sourceTally[sourceName] ?? 0) + 1;
      spinner.tick(totalMessages);

      const result = detect(message.text);
      if (result.count > 0) {
        totalSwears += result.count;
        agentStats.swears += result.count;

        for (const match of result.matches) {
          groupTally[match.group] = (groupTally[match.group] ?? 0) + 1;

          const variants = (variantTally[match.group] ??= {});
          variants[match.word] = (variants[match.word] ?? 0) + 1;
        }
      }
    }
  }

  spinner.setPhase("render");
  spinner.stop();

  const elapsedMs = Date.now() - started;
  const agents = buildAgentStats(perAgent);
  const words = buildWordStats(groupTally, variantTally);
  const sources = Object.entries(sourceTally)
    .map(([name, messages]) => ({ name, messages }))
    .sort((a, b) => b.messages - a.messages || a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    elapsedMs,
    totalMessages,
    totalSwears,
    overallRate: totalMessages > 0 ? (totalSwears / totalMessages) * 100 : 0,
    agents,
    words,
    sources,
    scope: {
      agent: options.agent,
      since: options.since?.toISOString(),
    },
  };
}

function adapterNameFor(agent: string): string {
  return agent.split(":")[0] ?? agent;
}

function buildAgentStats(
  perAgent: Record<string, { messages: number; swears: number }>,
): AgentStats[] {
  return Object.entries(perAgent)
    .map(([name, stats]) => ({
      name,
      messages: stats.messages,
      swears: stats.swears,
      rate: stats.messages > 0 ? (stats.swears / stats.messages) * 100 : 0,
    }))
    .sort((a, b) => b.rate - a.rate || b.swears - a.swears || a.name.localeCompare(b.name));
}

function buildWordStats(
  groupTally: Record<string, number>,
  variantTally: Record<string, Record<string, number>>,
): WordStats[] {
  return Object.entries(groupTally)
    .map(([group, count]) => ({
      group,
      count,
      variants: Object.entries(variantTally[group] ?? {})
        .map(([word, variantCount]) => ({ word, count: variantCount }))
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)),
    }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}
