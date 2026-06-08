"use client";

import { event } from "@/lib/gtag";

type TrackedLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  eventAction: string;
  eventCategory: string;
  eventLabel: string;
};

export function TrackedLink({
  eventAction,
  eventCategory,
  eventLabel,
  onClick,
  children,
  ...props
}: TrackedLinkProps) {
  return (
    <a
      {...props}
      onClick={(e) => {
        event({ action: eventAction, category: eventCategory, label: eventLabel });
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}
