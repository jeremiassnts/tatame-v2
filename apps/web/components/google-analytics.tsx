"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";
import { GA_MEASUREMENT_ID, pageview } from "@/lib/gtag";

function GoogleAnalyticsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    const url =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    pageview(url);
  }, [pathname, searchParams]);

  return null;
}

export function GoogleAnalytics() {
  const [activated, setActivated] = useState(false);

  const activate = useCallback(() => {
    setActivated(true);
  }, []);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;

    const events = ["scroll", "click", "touchstart", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, activate, { once: true, passive: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, activate));
    };
  }, [activate]);

  if (!GA_MEASUREMENT_ID || !activated) return null;

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_auto_event: true
            });
          `,
        }}
      />
      <Suspense fallback={null}>
        <GoogleAnalyticsInner />
      </Suspense>
    </>
  );
}
