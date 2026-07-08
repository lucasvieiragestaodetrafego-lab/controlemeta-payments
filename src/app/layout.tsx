import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meta Payments — CliniSales",
  description: "Controle de saldos das contas de anúncio Meta Ads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
