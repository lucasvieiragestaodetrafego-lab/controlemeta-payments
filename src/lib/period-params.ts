import type { PeriodSelection, ReportPeriod } from "./meta-insights";

const VALID_PRESETS: ReportPeriod[] = ["today", "last_7_days", "last_30_days", "current_month"];

/** Lê a seleção de período da query string (?period=X ou ?since=YYYY-MM-DD&until=YYYY-MM-DD). Sem parâmetros válidos, cai para last_7_days. */
export function parsePeriodFromSearchParams(params: URLSearchParams): PeriodSelection {
  const since = params.get("since");
  const until = params.get("until");
  if (since && until) return { type: "custom", since, until };

  const period = params.get("period");
  if (period && (VALID_PRESETS as string[]).includes(period)) {
    return { type: "preset", period: period as ReportPeriod };
  }
  return { type: "preset", period: "last_7_days" };
}

/** Serializa uma seleção de período de volta pra query string. */
export function periodToSearchParams(selection: PeriodSelection): URLSearchParams {
  const params = new URLSearchParams();
  if (selection.type === "preset") {
    params.set("period", selection.period);
  } else {
    params.set("since", selection.since);
    params.set("until", selection.until);
  }
  return params;
}

/** Converte o objeto searchParams do Next (Record<string, string|string[]|undefined>) pra URLSearchParams. */
export function searchParamsToURLSearchParams(
  sp: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }
  return params;
}
