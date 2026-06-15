"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

const SLIDES = [
  { src: "/mockup-1.png", alt: "Tatame app — início" },
  { src: "/mockup-3.png", alt: "Tatame app — financeiro" },
] as const;

const AUTO_MS = 4500;

function MockupFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-[400px] w-[200px] overflow-hidden rounded-[32px] border border-border bg-surface shadow-[0_20px_60px_#A078E830] md:h-[560px] md:w-[280px]">
      <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 200px, 280px" />
    </div>
  );
}

export function HeroMockupsV2() {
  const [active, setActive] = useState(0);

  const goNext = useCallback(() => {
    setActive((i) => (i + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const id = window.setInterval(goNext, AUTO_MS);
    return () => window.clearInterval(id);
  }, [goNext]);

  return (
    <>
      {/* Mobile: single mockup + auto carousel */}
      <div className="flex w-full flex-col items-center md:hidden">
        <div className="relative h-[400px] w-[200px]">
          {SLIDES.map((slide, i) => (
            <div
              key={slide.src}
              className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                i === active ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
              }`}
              aria-hidden={i !== active}
            >
              <MockupFrame src={slide.src} alt={slide.alt} />
            </div>
          ))}
        </div>
        <div
          className="mt-5 flex items-center justify-center gap-2"
          role="tablist"
          aria-label="Telas do app"
        >
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Tela ${i + 1} de ${SLIDES.length}`}
              className={`h-2 rounded-full transition-all ${
                i === active ? "w-6 bg-primary" : "w-2 bg-white/25 hover:bg-white/40"
              }`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      </div>

      {/* Desktop: two mockups side by side */}
      <div className="hidden w-full items-center justify-center gap-6 md:flex md:gap-10">
        {SLIDES.map((slide) => (
          <MockupFrame key={slide.src} src={slide.src} alt={slide.alt} />
        ))}
      </div>
    </>
  );
}
