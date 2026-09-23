/** Conversas não lidas: última mensagem inbound e ainda não aberta depois dela. */
export function isConversaUnread(params: {
  lastMessageDirection?: string | null;
  lastMessageAt?: Date | string | null;
  lastReadAt?: Date | string | null;
}): boolean {
  if (params.lastMessageDirection !== "INBOUND") return false;
  if (!params.lastMessageAt) return true;
  if (!params.lastReadAt) return true;
  const msgAt = new Date(params.lastMessageAt).getTime();
  const readAt = new Date(params.lastReadAt).getTime();
  return msgAt > readAt;
}
