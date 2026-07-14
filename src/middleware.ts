import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, exceto: arquivos estáticos do Next, favicon e a rota
     * do cron (que usa CRON_SECRET, não login de usuário).
     */
    "/((?!_next/static|_next/image|favicon.ico|api/cron).*)",
  ],
};
