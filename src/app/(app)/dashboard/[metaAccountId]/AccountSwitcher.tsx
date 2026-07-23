"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function AccountSwitcher({
  accounts,
  currentMetaAccountId,
}: {
  accounts: { metaAccountId: string; accountName: string }[];
  currentMetaAccountId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const query = searchParams.toString();
    router.push(`/dashboard/${next}${query ? `?${query}` : ""}`);
  }

  return (
    <select
      value={currentMetaAccountId}
      onChange={handleChange}
      className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
    >
      {accounts.map((a) => (
        <option key={a.metaAccountId} value={a.metaAccountId}>
          {a.accountName}
        </option>
      ))}
    </select>
  );
}
