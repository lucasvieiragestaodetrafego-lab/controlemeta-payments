import { login } from "./actions";
import NetworkBackground from "@/app/NetworkBackground";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <NetworkBackground />
      <form
        action={login}
        className="relative z-10 w-full max-w-sm space-y-4 rounded-lg border border-slate-800 bg-slate-900/90 p-6 backdrop-blur-sm"
      >
        <div>
          <h1 className="text-lg font-semibold">Meta Payments</h1>
          <p className="text-sm text-slate-400">Entre com seu e-mail e senha.</p>
        </div>

        {error && (
          <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm text-slate-300">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-slate-300">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
