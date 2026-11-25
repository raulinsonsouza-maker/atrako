"use client";

import { useRef, useState } from "react";

export type GalleryImage = { src: string; alt: string };

type Props = {
  title?: string;
  images: GalleryImage[];
};

/** Galeria mobile-first: foto principal + dots / thumbs. */
export function ProductGallery({ title, images }: Props) {
  const list = images.filter((img) => img.src);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  if (!list.length) return null;
  const current = list[Math.min(index, list.length - 1)]!;

  function go(delta: number) {
    setIndex((i) => (i + delta + list.length) % list.length);
  }

  return (
    <section className="product-gallery" aria-label={title || "Fotos do produto"}>
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.src} alt={current.alt} className="product-gallery__img shadow-product" draggable={false} />
        {list.length > 1 ? (
          <>
            <button type="button" className="product-gallery__nav product-gallery__nav--prev" onClick={() => go(-1)} aria-label="Foto anterior">
              ‹
            </button>
            <button type="button" className="product-gallery__nav product-gallery__nav--next" onClick={() => go(1)} aria-label="Próxima foto">
              ›
            </button>
          </>
        ) : null}
      </div>
      {list.length > 1 ? (
        <div className="product-gallery__dots" role="tablist" aria-label="Fotos">
          {list.map((img, i) => (
            <button
              key={`${img.src}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`product-gallery__dot${i === index ? " is-on" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Foto ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
      {list.length > 1 ? (
        <div className="product-gallery__thumbs">
          {list.map((img, i) => (
            <button
              key={`thumb-${img.src}-${i}`}
              type="button"
              className={`product-gallery__thumb${i === index ? " is-on" : ""}`}
              onClick={() => setIndex(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
