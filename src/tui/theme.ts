export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  amber: "\x1b[38;5;214m",
  amberSoft: "\x1b[38;5;222m",
  amberDim: "\x1b[38;5;136m",
  stone: "\x1b[38;5;180m",
};

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

export function paint(text: string, style: string, enabled = true): string {
  return enabled ? `${style}${text}${ANSI.reset}` : text;
}

export function bold(text: string, enabled = true): string {
  return paint(text, ANSI.bold, enabled);
}

export function dim(text: string, enabled = true): string {
  return paint(text, ANSI.dim, enabled);
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}
