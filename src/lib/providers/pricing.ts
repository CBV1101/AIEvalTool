export type TokenPrice = {
  inputPerMillion: number;
  outputPerMillion: number;
};

function price(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function readModelPricing(raw = process.env.EVAL_MODEL_PRICING): Record<string, TokenPrice> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const prices: Record<string, TokenPrice> = {};
    for (const [model, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const record = value as Record<string, unknown>;
      const inputPerMillion = price(record.inputPerMillion);
      const outputPerMillion = price(record.outputPerMillion);
      if (inputPerMillion === null || outputPerMillion === null) continue;
      prices[model] = { inputPerMillion, outputPerMillion };
    }
    return prices;
  } catch {
    return {};
  }
}

export function estimateCostUsd(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
  prices = readModelPricing(),
): number | null {
  const priceForModel = prices[model];
  if (!priceForModel || inputTokens === null || outputTokens === null) return null;
  return (
    (inputTokens / 1_000_000) * priceForModel.inputPerMillion +
    (outputTokens / 1_000_000) * priceForModel.outputPerMillion
  );
}

export function costLabel(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
  prices = readModelPricing(),
): string {
  const cost = estimateCostUsd(model, inputTokens, outputTokens, prices);
  if (cost === null) return "Cost unavailable.";
  return `Estimated cost $${cost.toFixed(4)}`;
}
