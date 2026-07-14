import { sparklinePoints } from "@/lib/sparkline";

const STROKE: Record<string, string> = {
  up: "#34d399", // subindo = bom (verde)
  down: "#f87171", // caindo = ruim (vermelho)
  flat: "#94a3b8", // estável / sem sinal (cinza)
};

export default function Sparkline({
  values,
  tone = "flat",
  width = 56,
  height = 16,
}: {
  values: number[];
  tone?: "up" | "down" | "flat";
  width?: number;
  height?: number;
}) {
  const points = sparklinePoints(values, width, height);
  if (!points) {
    return <span className="text-xs text-slate-600">—</span>;
  }
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline fill="none" stroke={STROKE[tone]} strokeWidth={1.5} points={points} />
    </svg>
  );
}
