export interface FunnelStep {
  label: string;
  value: number;
  /** Percentual em relação ao primeiro estágio (100 no primeiro). */
  percentOfFirst: number;
  /** Percentual de queda em relação ao estágio anterior (null no primeiro estágio ou se o anterior for 0). */
  dropFromPrevious: number | null;
}

/** Calcula percentuais de um funil a partir de estágios em ordem decrescente esperada. Função pura. */
export function computeFunnelSteps(steps: { label: string; value: number }[]): FunnelStep[] {
  const first = steps[0]?.value ?? 0;
  return steps.map((step, i) => {
    const previous = steps[i - 1]?.value;
    const percentOfFirst = first > 0 ? (step.value / first) * 100 : 0;
    const dropFromPrevious =
      i === 0 || previous == null || previous <= 0 ? null : ((previous - step.value) / previous) * 100;
    return { label: step.label, value: step.value, percentOfFirst, dropFromPrevious };
  });
}
