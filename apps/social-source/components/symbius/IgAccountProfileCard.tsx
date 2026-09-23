"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Instagram, Loader2, RefreshCw } from "lucide-react";

export type IgAccountProfile = {
  id: string;
  igUserId: string;
  igUsername?: string | null;
  igProfilePictureUrl?: string | null;
  status: string;
  messagesEnabled?: boolean;
};

export function IgAccountProfileCard({
  account,
  compact = false,
}: {
  account: IgAccountProfile;
  compact?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsRefresh = !account.igUsername || !account.igProfilePictureUrl;

  async function refreshProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/symbius/connect/refresh-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao atualizar perfil");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha ao atualizar perfil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "" : "symbius-card"}>
      <p className="text-sm text-[var(--symbius-muted)]">
        Conta Instagram conectada
      </p>
      <div className="mt-3 flex items-center gap-4">
        {account.igProfilePictureUrl ? (
          <Image
            src={account.igProfilePictureUrl}
            alt=""
            width={compact ? 48 : 64}
            height={compact ? 48 : 64}
            className="rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div
            className={`flex items-center justify-center rounded-full bg-pink-500/15 ${
              compact ? "h-12 w-12" : "h-16 w-16"
            }`}
          >
            <Instagram className="h-7 w-7 text-pink-500" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">
            @{account.igUsername ?? "instagram"}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--symbius-muted)]">
            ID: {account.igUserId}
          </p>
          <p className="mt-1 text-xs">
            <span className="text-[var(--symbius-accent)]">{account.status}</span>
            {account.messagesEnabled === false && (
              <span className="ml-2 text-amber-400">mensagens limitadas</span>
            )}
          </p>
        </div>
      </div>

      {needsRefresh && (
        <button
          type="button"
          onClick={refreshProfile}
          disabled={loading}
          className="symbius-btn-outline mt-4 inline-flex items-center gap-2 text-sm disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar perfil
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
