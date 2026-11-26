"use client";

import { useEffect, useRef, useState } from "react";

export type GalleryMedia = {
  src: string;
  alt: string;
  kind?: "image" | "video";
  poster?: string;
};

type Props = {
  title?: string;
  images: GalleryMedia[];
  /** Vídeo sem crop (contain) — uso no hero. */
  mode?: "reels" | "hero";
};

function isVideoItem(item: GalleryMedia) {
  return (item.kind ?? (item.src.endsWith(".mp4") ? "video" : "image")) === "video";
}

/** Galeria: swipe; no hero o vídeo fica contain (sem cortar). */
export function ProductGallery({ title, images, mode = "reels" }: Props) {
  const list = images.filter((img) => img.src);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const safeIndex = list.length ? Math.min(index, list.length - 1) : 0;
  const current = list[safeIndex];
  const showingVideo = current ? isVideoItem(current) : false;
  const isHero = mode === "hero";

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (showingVideo) void v.play().catch(() => null);
    else v.pause();
  }, [safeIndex, showingVideo]);

  if (!list.length || !current) return null;

  function go(delta: number) {
    setIndex((i) => (i + delta + list.length) % list.length);
  }

  return (
    <section
      className={`product-gallery${isHero ? " product-gallery--hero" : " product-gallery--reels"}`}
      aria-label={title || "Mídia do produto"}
    >
      {title ? <h2 className="product-gallery__title type-caption-strong text-[var(--ink)]">{title}</h2> : null}
      <div
        className={`product-gallery__main${showingVideo && isHero ? " is-video" : ""}`}
        onTouchStart={(e) => {
          touchX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null) return;
          const dx = end - start;
          if (Math.abs(dx) < 40) return;
          go(dx < 0 ? 1 : -1);
        }}
      >
        {showingVideo ? (
          <video
            key={current.src}
            ref={videoRef}
            className={`product-gallery__media${isHero ? " product-gallery__media--contain" : ""}`}
            src={current.src}
            poster={current.poster}
            muted
            playsInline
            loop
            autoPlay
            preload={isHero ? "auto" : "metadata"}
            controls={false}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.src}
            alt={current.alt}
            className="product-gallery__media shadow-product"
            draggable={false}
          />
        )}
        {list.length > 1 ? (
          <>
            <button
              type="button"
              className="product-gallery__nav product-gallery__nav--prev"
              onClick={() => go(-1)}
              aria-label="Anterior"
            >
              ‹
            </button>
            <button
              type="button"
              className="product-gallery__nav product-gallery__nav--next"
              onClick={() => go(1)}
              aria-label="Próximo"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {list.length > 1 ? (
        <div className="product-gallery__dots" role="tablist" aria-label="Mídia">
          {list.map((img, i) => (
            <button
              key={`${img.src}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === safeIndex}
              className={`product-gallery__dot${i === safeIndex ? " is-on" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Item ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
