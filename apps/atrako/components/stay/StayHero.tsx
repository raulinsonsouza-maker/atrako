"use client";

import { useEffect, useRef, useState } from "react";

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function StayHero({
  frameCount,
  eyebrow,
  title,
  lead,
  fallbackSrc,
}: {
  frameCount: number;
  eyebrow: string;
  title: string;
  lead: string;
  fallbackSrc?: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const firstNoteRef = useRef<HTMLDivElement>(null);
  const secondNoteRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const tickingRef = useRef(false);
  const currentFrameRef = useRef(-1);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loaded, setLoaded] = useState(frameCount < 1);

  useEffect(() => {
    if (frameCount < 1) return;
    let complete = 0;
    let cancelled = false;
    const images = Array.from({ length: frameCount }, (_, index) => {
      const image = new Image();
      image.decoding = "async";
      image.src = `/stay/frames/frame_${String(index + 1).padStart(4, "0")}.jpg`;
      const onDone = () => {
        complete += 1;
        if (!cancelled) setLoadProgress(complete / frameCount);
        if (complete === frameCount && !cancelled) setLoaded(true);
      };
      image.onload = onDone;
      image.onerror = onDone;
      return image;
    });
    framesRef.current = images;
    return () => {
      cancelled = true;
    };
  }, [frameCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section || !loaded || frameCount < 1) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const draw = (index: number) => {
      const image = framesRef.current[index];
      if (!image?.complete || !image.naturalWidth) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const imageRatio = image.naturalWidth / image.naturalHeight;
      const canvasRatio = width / height;
      let drawWidth = canvasRatio > imageRatio ? width : height * imageRatio;
      let drawHeight = canvasRatio > imageRatio ? width / imageRatio : height;
      if (window.innerWidth <= 768) {
        drawWidth *= 1.16;
        drawHeight *= 1.16;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = "#101511";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      currentFrameRef.current = -1;
      update();
    };

    const toggle = (node: HTMLElement | null, visible: boolean) => node?.classList.toggle("is-visible", visible);
    const update = () => {
      const rect = section.getBoundingClientRect();
      const progress = clamp(-rect.top / Math.max(1, section.offsetHeight - window.innerHeight));
      const frame = Math.min(frameCount - 1, Math.floor(progress * frameCount));
      if (frame !== currentFrameRef.current) {
        currentFrameRef.current = frame;
        draw(frame);
      }
      if (copyRef.current) copyRef.current.style.opacity = String(clamp(1 - progress / 0.12));
      toggle(firstNoteRef.current, progress > 0.18 && progress < 0.39);
      toggle(secondNoteRef.current, progress > 0.47 && progress < 0.69);
      toggle(finalRef.current, progress > 0.8);
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
    };
    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        update();
        tickingRef.current = false;
      });
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
  }, [loaded, frameCount]);

  if (frameCount < 1) {
    return (
      <section id="inicio" className="hero-still">
        {fallbackSrc ? <img src={fallbackSrc} alt="" /> : null}
        <div className="hero-shade" />
        <div className="hero-copy">
          <span className="eyebrow light">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{lead}</p>
          <a href="#reserva">Ver datas disponíveis</a>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} id="inicio" className="hero-scroll">
      <div className="hero-sticky">
        <canvas ref={canvasRef} className="hero-canvas" aria-label="Cabana revelada pela luz da floresta" />
        <div className="hero-shade" />
        <div className={`loader ${loaded ? "loader--done" : ""}`} aria-hidden={loaded}>
          <span className="loader-mark">A</span>
          <p>Preparando a experiência <strong>{Math.round(loadProgress * 100)}%</strong></p>
          <i><b style={{ transform: `scaleX(${loadProgress})` }} /></i>
        </div>
        <div ref={copyRef} className="hero-copy">
          <span className="eyebrow light">{eyebrow}</span>
          <h1>Mais perto<br />do que <em>importa.</em></h1>
          <p>{lead}</p>
          <a href="#reserva">Ver datas disponíveis</a>
        </div>
        <div ref={firstNoteRef} className="hero-note note-left">
          <span>01 · Essência</span>
          <h2>Arquitetura que acolhe.</h2>
          <p>Linhas puras, madeira e luz natural criam um abrigo contemporâneo em diálogo com a paisagem.</p>
        </div>
        <div ref={secondNoteRef} className="hero-note note-right">
          <span>02 · Atmosfera</span>
          <h2>A floresta entra em cena.</h2>
          <p>Grandes planos de vidro transformam cada estação em parte viva da experiência.</p>
        </div>
        <div ref={finalRef} className="hero-final">
          <span>Seu tempo. Seu lugar.</span>
          <strong>{eyebrow}</strong>
          <a href="#conceito">Explore o projeto</a>
        </div>
        <div className="scroll-cue"><span>Role para explorar</span></div>
        <div className="hero-progress"><i ref={progressRef} /></div>
      </div>
    </section>
  );
}
