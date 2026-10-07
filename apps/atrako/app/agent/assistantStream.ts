import type { AssistantConversation, AssistantMessage, AssistantPendingAction } from "./useAssistantHistory";

export type StreamHandlers = {
  onMeta?: (data: { conversation: AssistantConversation; userMessage: AssistantMessage; traceId: string }) => void;
  onStep?: (data: { id: string; tool: string; label: string }) => void;
  onToken?: (text: string) => void;
  onDiscard?: () => void;
  onAction?: (action: AssistantPendingAction) => void;
  onDone?: (data: { message: AssistantMessage; conversation: AssistantConversation }) => void;
  onError?: (data: { message: string; failed: AssistantMessage | null }) => void;
};

export class AssistantRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
  }
}

/** POST /api/atrako/assistant e despacha os eventos SSE. */
export async function streamAssistant(
  body: { message: string; conversationId: string | null; clientRequestId: string },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/atrako/assistant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new AssistantRequestError(
      data.message || data.error || "Não consegui responder agora.",
      response.status,
      data.error ?? null,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const dispatch = (raw: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(data.join("\n"));
    } catch {
      return;
    }
    switch (event) {
      case "meta":
        handlers.onMeta?.(payload as never);
        break;
      case "step":
        handlers.onStep?.(payload as never);
        break;
      case "token":
        handlers.onToken?.(String(payload.text ?? ""));
        break;
      case "discard":
        handlers.onDiscard?.();
        break;
      case "action":
        handlers.onAction?.(payload.action as AssistantPendingAction);
        break;
      case "done":
        handlers.onDone?.(payload as never);
        break;
      case "error":
        handlers.onError?.(payload as never);
        break;
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      dispatch(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.trim()) dispatch(buffer);
}
