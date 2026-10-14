import { costLabel } from "@/lib/providers/pricing";
import type { ResponseRecord, RunMode } from "@/lib/types";

export type MeasurementView = {
  measured: boolean;
  latency: string | null;
  tokens: string | null;
  cost: string;
  note: string | null;
};

export function measurementView(
  response: Pick<ResponseRecord, "source" | "model" | "inputTokens" | "outputTokens" | "latencyMs">,
  mode: RunMode,
): MeasurementView {
  if (mode === "demo" || response.source === "demo" || response.source === "sample") {
    return {
      measured: false,
      latency: null,
      tokens: null,
      cost: "Cost unavailable.",
      note: "Not a measurement.",
    };
  }
  if (response.source !== "model") {
    return {
      measured: false,
      latency: null,
      tokens: null,
      cost: "Cost unavailable.",
      note: null,
    };
  }
  const tokens =
    response.inputTokens === null || response.outputTokens === null
      ? "Tokens unavailable."
      : `${response.inputTokens} in · ${response.outputTokens} out`;
  return {
    measured: true,
    latency: response.latencyMs === null ? null : `${response.latencyMs} ms`,
    tokens,
    cost: costLabel(response.model, response.inputTokens, response.outputTokens),
    note: null,
  };
}
