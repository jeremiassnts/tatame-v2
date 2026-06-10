"use client";

import { event } from "@/lib/gtag";

type TrackedLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  eventName: string;
};

export function TrackedLink({
  eventName,
  onClick,
  children,
  ...props
}: TrackedLinkProps) {
  return (
    <a
      {...props}
      onClick={(e) => {
        event(eventName);
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}
