"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ATRAKO_OAUTH_MESSAGE,
  isAtrakoOAuthMessage,
  openOAuthPopup,
  type AtrakoOAuthMessage,
} from "@/lib/oauth/openOAuthPopup";

type Options = {
  onDone?: (msg: AtrakoOAuthMessage | { ok: false; cancelled: true }) => void;
};

/**
 * Abre OAuth em popup; escuta postMessage + poll closed.
 * Se popup for bloqueado, faz fallback same-tab (location.assign).
 */
export function useOAuthPopup(options: Options = {}) {
  const onDoneRef = useRef(options.onDone);
  onDoneRef.current = options.onDone;

  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settledRef = useRef(false);
  const [pending, setPending] = useState(false);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const finish = useCallback(
    (msg: AtrakoOAuthMessage | { ok: false; cancelled: true }) => {
      if (settledRef.current) return;
      settledRef.current = true;
      clearPoll();
      popupRef.current = null;
      setPending(false);
      onDoneRef.current?.(msg);
    },
    [clearPoll],
  );

  const cancel = useCallback(() => {
    try {
      popupRef.current?.close();
    } catch {
      /* ignore */
    }
    finish({ ok: false, cancelled: true });
  }, [finish]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isAtrakoOAuthMessage(event.data)) return;
      try {
        popupRef.current?.close();
      } catch {
        /* ignore */
      }
      finish(event.data);
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearPoll();
    };
  }, [finish, clearPoll]);

  const open = useCallback(
    (url: string) => {
      const popup = openOAuthPopup(url);
      if (!popup) {
        window.location.assign(url);
        return;
      }
      settledRef.current = false;
      popupRef.current = popup;
      setPending(true);
      clearPoll();
      pollRef.current = setInterval(() => {
        if (!popupRef.current || popupRef.current.closed) {
          finish({ ok: false, cancelled: true });
        }
      }, 500);
    },
    [clearPoll, finish],
  );

  return { open, cancel, pending, messageType: ATRAKO_OAUTH_MESSAGE };
}
