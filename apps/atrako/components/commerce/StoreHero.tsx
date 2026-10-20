"use client";

import { useEffect, useState } from "react";
import type { StoreBanner } from "@/lib/commerce/banners";

function BannerMedia({ slide }: { slide: StoreBanner }) {
  const desktop = slide.imageUrl || slide.mobileImageUrl || "";
  const mobile = slide.mobileImageUrl || slide.imageUrl || "";
  const img = (
    <picture>
      {mobile !== desktop ? <source media="(max-width: 640px)" srcSet={mobile} /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={desktop} alt="" />
    </picture>
  );
  if (!slide.href) return img;
  const external = /^https?:\/\//i.test(slide.href);
  return (
    <a
      href={slide.href}
      className="store-hero__link"
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {img}
    </a>
  );
}

export function StoreHero({ banners }: { banners: StoreBanner[]; storeName?: string }) {
  const slides = banners.filter((b) => b.active && (b.imageUrl || b.mobileImageUrl));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(t);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <section className="store-hero store-hero--banner" aria-label="Banners">
      <div className="store-hero__slides">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className={`store-hero__slide${i === index ? " is-active" : ""}`}
            aria-hidden={i !== index}
          >
            <BannerMedia slide={slide} />
          </div>
        ))}
      </div>
      {slides.length > 1 ? (
        <div className="store-hero__dots" role="tablist" aria-label="Slides">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={i === index ? "is-active" : undefined}
              onClick={() => setIndex(i)}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
