"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { event } from "@/lib/gtag";

interface ButtonColorfulProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  label: string;
  eventName?: string;
}

export function ButtonColorful({
  className,
  label,
  eventName,
  onClick,
  ...props
}: ButtonColorfulProps) {
  return (
    <a
      className={cn(
        "relative group border border-primary/20 bg-primary/5 hover:bg-primary/0",
        "inline-flex items-center justify-center gap-2.5 rounded-full px-8 py-3",
        "text-base font-semibold text-white cursor-pointer",
        "mx-auto text-center",
        className
      )}
      onClick={(e) => {
        if (eventName) event(eventName);
        onClick?.(e);
      }}
      {...props}
    >
      {/* Top neon line */}
      <span className="absolute h-px opacity-0 group-hover:opacity-100 transition-all duration-500 ease-in-out inset-x-0 inset-y-0 bg-gradient-to-r w-3/4 mx-auto from-transparent via-primary to-transparent" />

      {label}
      <ArrowRight className="h-5 w-5 text-white/90" />

      {/* Bottom neon line */}
      <span className="absolute group-hover:opacity-30 transition-all duration-500 ease-in-out inset-x-0 h-px -bottom-px bg-gradient-to-r w-3/4 mx-auto from-transparent via-primary to-transparent" />
    </a>
  );
}
