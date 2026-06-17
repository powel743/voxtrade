// ─────────────────────────────────────────────────────────────────────────────
// StatusIndicator — polls GET /status every 10s, shows MT5 connection + balance
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from "@tanstack/react-query";
import { getStatus } from "../api/trade";
import type { StatusResponse } from "../types";

function money(n: number | undefined): string {
  if (n === undefined) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function StatusIndicator(): JSX.Element {
  const { data, isLoading, isError } = useQuery<StatusResponse>({
    queryKey: ["status"],
    queryFn: getStatus,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const online = !!data && data.bridge === "online" && data.connected === true;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary text-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-notrade animate-pulse-dot" />
        <span>Checking status…</span>
      </div>
    );
  }

  if (isError || !data || data.bridge === "offline" || !online) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-sell" />
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-sell">Bridge Offline</span>
          <span className="text-text-secondary text-xs">
            {data?.message ?? "Start bridge.py + ngrok on your Windows PC"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 rounded-full bg-buy animate-pulse-dot" />
      <div className="flex flex-col leading-tight">
        <span className="font-semibold text-buy">MT5 Connected</span>
        <span className="text-text-secondary text-xs">
          Bal ${money(data.balance)} · Eq ${money(data.equity)}
          {data.account ? ` · #${data.account}` : ""}
        </span>
      </div>
    </div>
  );
}
