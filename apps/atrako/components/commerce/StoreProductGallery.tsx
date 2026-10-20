"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Share2 } from "lucide-react";

export type GalleryImage = { src: string; alt?: string; kind?: "image" | "video" };

function isVideo(item: GalleryImage) {
  if (item.kind === "video") return true;
  return /\.(mp4|webm)(\?|$)/i.test(item.src);
}

function uniqueImages(images: GalleryImage[]): GalleryImage[] {
  const seen = new Set<string>();
  const out: GalleryImage[] = [];
  for (const img of images) {
    const src = img.src?.trim();
    if (!src || seen.has(src)) continue;
    seen.add(src);
    out.push({ src, alt: img.alt });
  }
  return out;
}

export function StoreProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const list = uniqueImages(images);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  const listKey = list.map((i) => i.src).join("|");
  useEffect(() => {
    setActive(0);
  }, [listKey]);

  function refreshScroll() {
    const el = thumbsRef.current;
    if (!el) {
      setCanUp(false);
      setCanDown(false);
      return;
    }
    setCanUp(el.scrollTop > 4);
    setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }

  useEffect(() => {
    refreshScroll();
    const el = thumbsRef.current;
    if (!el) return;
    el.addEventListener("scroll", refreshScroll);
    const ro = new ResizeObserver(refreshScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", refreshScroll);
      ro.disconnect();
    };
  }, [list.length]);

  const current = list[active] ?? null;
  const currentIsVideo = current ? isVideo(current) : false;

  useEffect(() => {
    const video = mainVideoRef.current;
    if (!video || !currentIsVideo) return;
    video.muted = true;
    video.defaultMuted = true;
    const start = () => {
      video.muted = true;
      void video.play().catch(() => {});
    };
    if (video.readyState >= 2) start();
    else video.addEventListener("loadeddata", start, { once: true });
    return () => {
      video.removeEventListener("loadeddata", start);
      video.pause();
    };
  }, [current?.src, currentIsVideo]);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: productName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="store-gallery">
      {list.length > 0 ? (
        <div className="store-gallery__thumbs-col">
          {canUp ? (
            <button
              type="button"
              className="store-gallery__more"
              aria-label="Imagens anteriores"
              onClick={() => thumbsRef.current?.scrollBy({ top: -120, behavior: "smooth" })}
            >
              <ChevronUp className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
          <div className="store-gallery__thumbs" ref={thumbsRef}>
            {list.map((img, i) => (
              <button
                key={img.src}
                type="button"
                className={`store-gallery__thumb${i === active ? " is-active" : ""}`}
                onClick={() => setActive(i)}
                aria-label={`Imagem ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
              >
                {isVideo(img) ? (
                  <video src={img.src} muted playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.src} alt="" />
                )}
              </button>
            ))}
          </div>
          {canDown || list.length > 4 ? (
            <button
              type="button"
              className="store-gallery__more"
              aria-label="Mais imagens"
              onClick={() => thumbsRef.current?.scrollBy({ top: 120, behavior: "smooth" })}
            >
              <ChevronDown className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="store-gallery__main">
        <button type="button" className="store-gallery__share" onClick={() => void share()}>
          <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          {copied ? "Link copiado" : "Compartilhe"}
        </button>
        {current ? (
          isVideo(current) ? (
            <video
              key={current.src}
              ref={mainVideoRef}
              src={current.src}
              muted
              autoPlay
              loop
              playsInline
              preload="auto"
              controls
              className="h-full w-full object-contain"
              onVolumeChange={(e) => {
                if (!e.currentTarget.muted) e.currentTarget.muted = true;
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.src}
              alt={current.alt || productName}
              className="shadow-product"
            />
          )
        ) : (
          <div className="store-gallery__empty">Sem imagem</div>
        )}
      </div>
    </div>
  );
}
