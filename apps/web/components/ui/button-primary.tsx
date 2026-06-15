"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { event } from "@/lib/gtag";

interface ButtonPrimaryProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  label: string;
  eventName?: string;
}

export function ButtonPrimary({
  className,
  label,
  eventName,
  onClick,
  ...props
}: ButtonPrimaryProps) {
  return (
    <a
      className={cn(
        "inline-flex items-center gap-2 rounded-xl bg-primary/70 px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer",
        className
      )}
      onClick={(e) => {
        if (eventName) event(eventName);
        onClick?.(e);
      }}
      {...props}
    >
      {label}
      <ArrowUpRight className="h-4 w-4" />
    </a>
  );
}
