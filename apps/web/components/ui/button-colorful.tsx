"use client";

import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { event } from "@/lib/gtag";

interface ButtonColorfulProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
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
        "relative inline-flex h-12 items-center justify-center overflow-hidden rounded-xl px-8",
        "bg-surface",
        "transition-all duration-200",
        "group cursor-pointer",
        className
      )}
      onClick={(e) => {
        if (eventName) event(eventName);
        onClick?.(e);
      }}
      {...props}
    >
      {/* Gradient background effect */}
      <div
        className={cn(
          "absolute inset-0",
          "bg-gradient-to-r from-primary via-[#8B5CF6] to-primary-dark",
          "opacity-60 group-hover:opacity-100",
          "blur-sm transition-opacity duration-500"
        )}
      />

      {/* Content */}
      <div className="relative flex items-center justify-center gap-2.5">
        <span className="text-base font-semibold text-white">{label}</span>
        <ArrowRight className="h-5 w-5 text-white/90" />
      </div>
    </a>
  );
}
