"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import type { Artifact } from "@/lib/atrako-agent/artifacts";

export type AssistantStep = { tool: string; label: string; source?: string; coverage: string };

export type AssistantPendingAction = {
  tool: string;
  summary: string;
  preview: Record<string, unknown>;
};

export type AssistantActionResult = {
  kind: "landing_page" | "form";
  id: string;
  name: string;
  editPath: string;
  publicPath: string;
};

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: string;
  createdAt: string;
  durationMs?: number | null;
  steps: AssistantStep[];
  pendingAction: AssistantPendingAction | null;
  actionStatus: "pending" | "confirmed" | "cancelled" | "failed" | null;
  actionResult: AssistantActionResult | null;
  artifacts?: Artifact[];
};

export type AssistantConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AssistantAiStatus = {
  ready: boolean;
  canManage: boolean;
};

type ListResponse = {
  workspaceId: string;
  conversations: AssistantConversation[];
  ai: AssistantAiStatus;
};

const listKey = (workspaceId: string | null | undefined) => ["atrako-assistant", workspaceId] as const;

/**
 * Histórico do Atrako salvo no servidor (por workspace + pessoa).
 * Mensagens de cada conversa ficam em cache local depois do primeiro carregamento.
 */
export function useAssistantHistory() {
  const qc = useQueryClient();
  const { workspaceId, isReady } = useActiveWorkspace();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messagesById, setMessagesById] = useState<Record<string, AssistantMessage[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: listKey(workspaceId),
    queryFn: async () => {
      const r = await fetch("/api/atrako/assistant");
      if (!r.ok) throw new Error("Não foi possível carregar as conversas");
      return (await r.json()) as ListResponse;
    },
    enabled: isReady,
    staleTime: 30_000,
  });

  useEffect(() => {
    setActiveId(null);
    setMessagesById({});
  }, [workspaceId]);

  const conversations = useMemo(
    () => [...(list.data?.conversations ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [list.data?.conversations],
  );

  const select = useCallback(
    async (id: string) => {
      setActiveId(id);
      if (messagesById[id]) return;
      setLoadingId(id);
      try {
        const r = await fetch(`/api/atrako/assistant?conversationId=${encodeURIComponent(id)}`);
        if (!r.ok) return;
        const data = (await r.json()) as { messages: AssistantMessage[] };
        setMessagesById((cur) => ({ ...cur, [id]: data.messages }));
      } finally {
        setLoadingId((cur) => (cur === id ? null : cur));
      }
    },
    [messagesById],
  );

  const upsertConversation = useCallback(
    (conversation: AssistantConversation) => {
      qc.setQueryData<ListResponse>(listKey(workspaceId), (cur) => {
        if (!cur) return cur;
        const rest = cur.conversations.filter((c) => c.id !== conversation.id);
        return { ...cur, conversations: [conversation, ...rest] };
      });
    },
    [qc, workspaceId],
  );

  const setMessages = useCallback(
    (id: string, fn: (list: AssistantMessage[]) => AssistantMessage[]) => {
      setMessagesById((cur) => ({ ...cur, [id]: fn(cur[id] ?? []) }));
    },
    [],
  );

  const moveMessages = useCallback((from: string, to: string) => {
    setMessagesById((cur) => {
      if (!cur[from]) return cur;
      const { [from]: moved, ...rest } = cur;
      return { ...rest, [to]: [...(rest[to] ?? []), ...moved] };
    });
  }, []);

  const remove = useCallback(
    async (id: string) => {
      qc.setQueryData<ListResponse>(listKey(workspaceId), (cur) =>
        cur ? { ...cur, conversations: cur.conversations.filter((c) => c.id !== id) } : cur,
      );
      setActiveId((cur) => (cur === id ? null : cur));
      setMessagesById(({ [id]: _drop, ...rest }) => rest);
      await fetch(`/api/atrako/assistant?conversationId=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
    },
    [qc, workspaceId],
  );

  const refreshAi = useCallback(() => qc.invalidateQueries({ queryKey: listKey(workspaceId) }), [qc, workspaceId]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return {
    conversations,
    active,
    activeId,
    messagesFor: (id: string | null) => (id ? messagesById[id] ?? [] : []),
    loadingMessages: loadingId !== null && loadingId === activeId,
    hydrated: list.isFetched,
    ai: list.data?.ai ?? null,
    select,
    setActiveId,
    startNew: () => setActiveId(null),
    upsertConversation,
    setMessages,
    moveMessages,
    remove,
    refreshAi,
  };
}
