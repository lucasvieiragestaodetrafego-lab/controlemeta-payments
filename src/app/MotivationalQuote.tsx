"use client";

import { useEffect, useState } from "react";
import { getQuoteForNow, type Quote } from "@/lib/quotes";

/** Frase motivacional que troca sozinha a cada hora (calculado pela hora atual). */
export default function MotivationalQuote() {
  const [quote, setQuote] = useState<Quote>(() => getQuoteForNow());

  useEffect(() => {
    const id = setInterval(() => setQuote(getQuoteForNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-400">
      <span className="text-sky-500">❝</span>
      <p className="italic">
        {quote.text} <span className="not-italic text-slate-500">— {quote.author}</span>
      </p>
    </div>
  );
}
