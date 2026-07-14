import { NextResponse } from "next/server";
import { checkAllBalances } from "@/lib/check-balances";

export const maxDuration = 60;

/**
 * Endpoint chamado automaticamente pelo Vercel Cron (veja vercel.json).
 * Protegido por CRON_SECRET: o Vercel envia esse valor sozinho no header
 * Authorization quando a variável de ambiente está configurada.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const results = await checkAllBalances();
    return NextResponse.json({ ok: true, checked: results.length, results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
