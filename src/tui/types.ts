export interface AgentStats {
  name: string;
  messages: number;
  swears: number;
  rate: number;
}

export interface VariantStats {
  word: string;
  count: number;
}

export interface WordStats {
  group: string;
  count: number;
  variants: VariantStats[];
}

export interface SourceStats {
  name: string;
  messages: number;
}

export interface ScanScope {
  agent?: string;
  since?: string;
}

export interface ScanResult {
  generatedAt: string;
  elapsedMs: number;
  totalMessages: number;
  totalSwears: number;
  overallRate: number;
  agents: AgentStats[];
  words: WordStats[];
  sources: SourceStats[];
  scope: ScanScope;
}

export interface RenderOptions {
  json?: boolean;
  logo?: boolean;
  logoPath?: string;
  plain?: boolean;
  top?: number;
  tui?: boolean;
}
