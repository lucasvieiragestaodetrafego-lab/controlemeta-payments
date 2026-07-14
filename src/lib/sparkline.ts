/**
 * Converte uma série de valores em pontos para <polyline points="…"> de um SVG
 * de largura×altura dadas. Y é invertido (valor maior fica no topo, y menor).
 * Casos degenerados (vazio, 1 ponto, todos iguais) caem numa linha reta no meio.
 */
export function sparklinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";

  if (values.length === 1) {
    return `0,${Math.round(height / 2)} ${width},${Math.round(height / 2)}`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const stepX = width / (values.length - 1);

  return values
    .map((v, i) => {
      const x = Math.round(i * stepX);
      const y = span === 0 ? height / 2 : height - ((v - min) / span) * height;
      return `${x},${Math.round(y)}`;
    })
    .join(" ");
}
