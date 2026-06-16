"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

const SLIDES = [
  { src: "/mockup-iphone.png", alt: "Tatame app — tela inicial" },
  { src: "/mockup-iphone-2.png", alt: "Tatame app — financeiro" },
] as const;

const AUTO_MS = 4500;

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
        <div className="relative h-[420px] w-[210px]">
          {SLIDES.map((slide, i) => (
            <div
              key={slide.src}
              className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                i === active ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
              }`}
              aria-hidden={i !== active}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                width={210}
                height={420}
                className="h-full w-full object-contain"
                sizes="210px"
                priority={i === 0}
                fetchPriority={i === 0 ? "high" : "low"}
              />
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
        {SLIDES.map((slide, i) => (
          <div key={slide.src} className="relative h-[580px] w-[290px]">
            <Image
              src={slide.src}
              alt={slide.alt}
              width={290}
              height={580}
              className="h-full w-full object-contain"
              sizes="290px"
              priority={i === 0}
              fetchPriority={i === 0 ? "high" : "low"}
            />
          </div>
        ))}
      </div>
    </>
  );
}
