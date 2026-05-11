import { scan } from "./commands/scan";

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  scan,
};

function usage(): void {
  console.log(`gfdi - count how many times you swear at your coding agents

Usage:
  gfdi <command> [options]
  fuckupinator <command> [options]
  fuckup <command> [options]

Commands:
  scan          Scan sessions for profanity with the dashboard report

Options:
  --help, -h    Show this help message
  --version     Show version

Examples:
  gfdi scan
  fuckup scan
  gfdi --tui
  gfdi scan --agent claude
  gfdi scan --agent hermes
  gfdi scan --since 2025-01-01
  gfdi --json --agent hermes:wizard`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "--help" || command === "-h") {
    usage();
    process.exit(0);
  }

  if (command === "--version") {
    console.log("0.3.1");
    process.exit(0);
  }

  // If no command or not a known command, default to scan
  const handler = command ? COMMANDS[command] : undefined;
  if (handler) {
    await handler(args.slice(1));
  } else {
    // Pass all args through to scan (covers both no-arg and unknown-arg cases)
    await scan(args);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
