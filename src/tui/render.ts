import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ANSI, bold, dim, paint, stripAnsi } from "./theme";
import type { AgentStats, RenderOptions, ScanResult, WordStats } from "./types";

const DEFAULT_LOGO_PATH = join(homedir(), "Downloads", "fuckup.txt");
const FALLBACK_LOGO = [
  "FFFFFFFF  UUU  UUU  CCCCCC  KKK  KKK  UUU  UUU  PPPPPP",
  "FFF       UUU  UUU CCC      KKK KKK   UUU  UUU  PPP  PP",
  "FFFFFF    UUU  UUU CCC      KKKKK     UUU  UUU  PPPPPP",
  "FFF       UUU  UUU CCC      KKK KKK   UUU  UUU  PPP",
  "FFF        UUUUU    CCCCCC  KKK  KKK   UUUUU   PPP",
].join("\n");

export function renderScanResult(result: ScanResult, options: RenderOptions): void {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const useTui = options.tui || (!options.plain && process.stdout.isTTY);
  if (!useTui || options.plain) {
    renderPlain(result, options);
    return;
  }

  renderDashboard(result, options);
}

function renderDashboard(result: ScanResult, options: RenderOptions): void {
  const width = terminalWidth();
  const top = options.top ?? 10;
  const agents = result.agents.slice();
  const words = result.words.slice(0, top);

  console.log("");
  if (options.logo !== false && width >= 80) {
    console.log(centerLines(loadLogo(options.logoPath), width, ANSI.amberSoft));
    console.log("");
  }

  console.log(center(`>===<  ${paint("fuckupinator", ANSI.amberSoft)}  local agent audit  >===<`, width));
  console.log(center(dim(scopeLine(result), true), width));
  console.log("");
  console.log(rule(width));
  console.log(summaryLine(result));
  console.log(rule(width));
  console.log("");
  console.log(sectionTitle("agents by swear rate"));
  renderAgents(agents, width);

  if (words.length > 0) {
    console.log("");
    console.log(sectionTitle(`top words (${words.length})`));
    renderWords(words, width);
  }

  if (result.sources.length > 0) {
    console.log("");
    console.log(sectionTitle("coverage"));
    const shownSources = result.sources
      .slice(0, 8)
      .map((source) => `${source.name}:${source.messages}`);
    if (result.sources.length > shownSources.length) {
      shownSources.push(`+${result.sources.length - shownSources.length} more`);
    }
    console.log(`  ${dim(shownSources.join("  "))}`);
  }

  console.log("");
  console.log(dim("  hints: fuckup --plain | fuckup --json | fuckup --agent hermes | fuckup --top 20"));
  console.log("");
}

function renderPlain(result: ScanResult, options: RenderOptions): void {
  const top = options.top ?? 10;
  console.log("");
  console.log(`  fuckupinator report`);
  console.log(`  ${"-".repeat(30)}`);
  console.log("");
  console.log(`  messages scanned  ${result.totalMessages}`);
  console.log(`  total swears      ${result.totalSwears}`);
  console.log(`  overall rate      ${formatRate(result.overallRate)}`);

  if (result.agents.length > 0) {
    const nameWidth = Math.max(10, ...result.agents.map((agent) => agent.name.length));
    console.log("");
    console.log("  by agent");
    for (const agent of result.agents) {
      console.log(
        `    ${agent.name.padEnd(nameWidth)} ${String(agent.swears).padStart(4)} in ${agent.messages} messages (${formatRate(agent.rate)})`,
      );
    }
  }

  if (result.words.length > 0) {
    console.log("");
    console.log("  top words");
    for (const word of result.words.slice(0, top)) {
      const variants = word.variants
        .filter((variant) => variant.word !== word.group)
        .slice(0, 15)
        .map((variant) => `${variant.word} ${variant.count}`)
        .join(", ");
      const suffix = variants ? ` (${variants})` : "";
      console.log(`    ${word.group.padEnd(12)} ${String(word.count).padStart(4)}${suffix}`);
    }
  }

  console.log("");
}

function renderAgents(agents: AgentStats[], width: number): void {
  const nameWidth = Math.min(Math.max(10, ...agents.map((agent) => agent.name.length)), 24);
  const barWidth = Math.max(10, Math.min(28, width - nameWidth - 48));

  console.log(
    `  ${dim("agent".padEnd(nameWidth))}  ${dim("swears".padStart(7))}  ${dim("messages".padStart(8))}  ${dim("rate".padStart(7))}  ${dim("heat")}`,
  );

  for (const agent of agents) {
    const hot = agent.rate >= 50 ? ANSI.red : agent.rate >= 25 ? ANSI.amber : ANSI.stone;
    const name = paint(truncate(agent.name, nameWidth).padEnd(nameWidth), ANSI.cyan);
    const barText = bar(agent.rate, barWidth);
    console.log(
      `  ${name}  ${paint(String(agent.swears).padStart(7), hot)}  ${String(agent.messages).padStart(8)}  ${paint(formatRate(agent.rate).padStart(7), hot)}  ${paint(barText, hot)}`,
    );
  }
}

function renderWords(words: WordStats[], width: number): void {
  const wordWidth = 12;
  for (const word of words) {
    const variants = word.variants
      .filter((variant) => variant.word !== word.group)
      .slice(0, width > 110 ? 12 : 6)
      .map((variant) => `${variant.word} ${variant.count}`)
      .join(", ");
    const suffix = variants ? dim(` (${variants})`) : "";
    console.log(
      `  ${paint(word.group.padEnd(wordWidth), ANSI.amberSoft)}  ${paint(String(word.count).padStart(5), ANSI.amber)}${suffix}`,
    );
  }
}

function loadLogo(path?: string): string {
  const logoPath = path ?? DEFAULT_LOGO_PATH;
  try {
    return readFileSync(logoPath, "utf-8").trimEnd();
  } catch {
    return FALLBACK_LOGO;
  }
}

function centerLines(text: string, width: number, style: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => center(paint(line, style), width, line.length))
    .join("\n");
}

function center(text: string, width: number, rawLength?: number): string {
  const length = rawLength ?? stripAnsi(text).length;
  const padding = Math.max(0, Math.floor((width - length) / 2));
  return `${" ".repeat(padding)}${text}`;
}

function summaryLine(result: ScanResult): string {
  const elapsed = `${(result.elapsedMs / 1000).toFixed(1)}s`;
  return [
    metric("messages", result.totalMessages),
    metric("swears", result.totalSwears, ANSI.red),
    metric("rate", formatRate(result.overallRate), ANSI.amberSoft),
    metric("agents", result.agents.length),
    metric("elapsed", elapsed),
  ].join("  ");
}

function metric(label: string, value: string | number, style = ANSI.stone): string {
  return `  ${dim(label)} ${paint(String(value), `${ANSI.bold}${style}`)}`;
}

function sectionTitle(title: string): string {
  return `  ${paint(">===<", ANSI.amberDim)}  ${bold(title)}`;
}

function scopeLine(result: ScanResult): string {
  const parts = ["scan local sessions"];
  if (result.scope.agent) {
    parts.push(`agent ${result.scope.agent}`);
  } else {
    parts.push("all adapters");
  }
  if (result.scope.since) {
    parts.push(`since ${result.scope.since}`);
  } else {
    parts.push("all time");
  }
  parts.push(new Date(result.generatedAt).toLocaleString());
  return parts.join(" | ");
}

function rule(width: number): string {
  return paint(`  ${"=".repeat(Math.min(width - 4, 100))}`, ANSI.amberDim);
}

function bar(rate: number, width: number): string {
  const filled = Math.max(0, Math.min(width, Math.round((rate / 100) * width)));
  return `${"#".repeat(filled)}${".".repeat(width - filled)}`;
}

function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

function terminalWidth(): number {
  return Math.max(60, process.stdout.columns ?? 100);
}

function truncate(value: string, width: number): string {
  if (value.length <= width) {
    return value;
  }
  if (width <= 1) {
    return value.slice(0, width);
  }
  return `${value.slice(0, width - 1)}~`;
}
