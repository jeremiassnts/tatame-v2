"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { event } from "@/lib/gtag";

interface ButtonColorfulProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  label: string;
  eventName?: string;
  glowClassName?: string;
}

export function ButtonColorful({
  className,
  label,
  eventName,
  glowClassName,
  onClick,
  ...props
}: ButtonColorfulProps) {
  return (
    <div className="relative group">
      {/* Gradient glow */}
      <div
        className={cn(
          "absolute -inset-[2px] rounded-xl bg-gradient-to-r from-purple-400 via-violet-500 to-blue-500 opacity-75 blur-lg transition-all",
          "group-hover:opacity-100 group-hover:blur-xl",
          glowClassName
        )}
      />

      {/* Button */}
      <a
        className={cn(
          "relative flex items-center justify-center gap-2.5 rounded-xl px-8 py-4",
          "bg-background/90 text-white shadow-xl",
          "transition-all hover:bg-background/70",
          "border border-border-light cursor-pointer",
          className
        )}
        onClick={(e) => {
          if (eventName) event(eventName);
          onClick?.(e);
        }}
        {...props}
      >
        <span className="text-base font-semibold">{label}</span>
        <ArrowRight className="h-5 w-5 text-white/90" />
      </a>
    </div>
  );
}
