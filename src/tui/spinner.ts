import { ANSI, dim, paint } from "./theme";

interface SpinnerState {
  adapter?: string;
  elapsedMs: number;
  messages: number;
  phase: string;
}

interface SpinnerOptions {
  enabled: boolean;
}

const FRAMES = ["|", "/", "-", "\\"];

export function createSpinner(options: SpinnerOptions) {
  let frame = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let started = Date.now();
  const state: SpinnerState = {
    elapsedMs: 0,
    messages: 0,
    phase: "discover",
  };

  function render(): void {
    if (!options.enabled) {
      return;
    }

    state.elapsedMs = Date.now() - started;
    const glyph = FRAMES[frame % FRAMES.length] ?? "|";
    frame++;

    const adapter = state.adapter ? ` adapter=${state.adapter}` : "";
    const elapsed = `${(state.elapsedMs / 1000).toFixed(1)}s`;
    const line = [
      paint(glyph, ANSI.amberSoft),
      paint(state.phase.padEnd(8), ANSI.amber),
      dim(`messages=${state.messages}`),
      dim(`elapsed=${elapsed}`),
      dim(adapter.trim()),
    ]
      .filter(Boolean)
      .join("  ");

    process.stdout.write(`\r\x1b[2K  ${line}`);
  }

  return {
    start(phase = "discover") {
      if (!options.enabled) {
        return;
      }
      started = Date.now();
      state.phase = phase;
      render();
      timer = setInterval(render, 120);
    },
    setAdapter(adapter: string) {
      state.adapter = adapter;
      state.phase = "scan";
      render();
    },
    setPhase(phase: string) {
      state.phase = phase;
      render();
    },
    tick(messages: number) {
      state.messages = messages;
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (options.enabled) {
        process.stdout.write("\r\x1b[2K");
      }
    },
  };
}
