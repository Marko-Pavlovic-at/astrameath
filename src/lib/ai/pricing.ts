/** USD per token, by model prefix. Falls back to Haiku pricing. */
const PRICING: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-haiku-4-5": {
    input: 1.0 / 1_000_000,
    output: 5.0 / 1_000_000,
    cacheWrite: 1.25 / 1_000_000,
    cacheRead: 0.1 / 1_000_000,
  },
};

export type UsageTokens = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export function computeCostUsd(model: string, usage: UsageTokens): number {
  const key =
    Object.keys(PRICING).find((k) => model.startsWith(k)) ?? "claude-haiku-4-5";
  const p = PRICING[key];
  return (
    (usage.input_tokens ?? 0) * p.input +
    (usage.output_tokens ?? 0) * p.output +
    (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite +
    (usage.cache_read_input_tokens ?? 0) * p.cacheRead
  );
}

/** Total tokens entering the model (uncached + cache write + cache read). */
export function totalInputTokens(usage: UsageTokens): number {
  return (
    (usage.input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  );
}
