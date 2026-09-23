"use client";

import { useEffect, useRef } from "react";

type Props = {
  src: string;
  className?: string;
  ariaLabel?: string;
};

/** Vídeo em loop mudo, sem controles — só demonstração visual. */
export function LpAutoVideo({
  src,
  className,
  ariaLabel = "Demonstração visual do produto",
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    const play = () => {
      void el.play().catch(() => undefined);
    };
    play();
    const onVisibility = () => {
      if (document.hidden) el.pause();
      else play();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [src]);

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      disablePictureInPicture
      disableRemotePlayback
      controls={false}
      tabIndex={-1}
      aria-label={ariaLabel}
    />
  );
}
