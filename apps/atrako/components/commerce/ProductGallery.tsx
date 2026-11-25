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
};

function isVideoItem(item: GalleryMedia) {
  return (item.kind ?? (item.src.endsWith(".mp4") ? "video" : "image")) === "video";
}

/** Galeria estilo reels: swipe horizontal, vídeo muted autoplay como 1º item. */
export function ProductGallery({ title, images }: Props) {
  const list = images.filter((img) => img.src);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const safeIndex = list.length ? Math.min(index, list.length - 1) : 0;
  const current = list[safeIndex];
  const showingVideo = current ? isVideoItem(current) : false;

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
    <section className="product-gallery product-gallery--reels" aria-label={title || "Mídia do produto"}>
      {title ? <h2 className="product-gallery__title type-caption-strong text-[var(--ink)]">{title}</h2> : null}
      <div
        className="product-gallery__main"
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
            className="product-gallery__media"
            src={current.src}
            poster={current.poster}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
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
        {showingVideo ? <span className="product-gallery__badge type-fine-print">Reel</span> : null}
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
      {list.length > 1 ? (
        <div className="product-gallery__thumbs">
          {list.map((img, i) => {
            const vid = isVideoItem(img);
            return (
              <button
                key={`thumb-${img.src}-${i}`}
                type="button"
                className={`product-gallery__thumb${i === safeIndex ? " is-on" : ""}`}
                onClick={() => setIndex(i)}
              >
                {vid ? (
                  <span className="product-gallery__thumb-video type-fine-print">▶</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.poster || img.src} alt="" />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
