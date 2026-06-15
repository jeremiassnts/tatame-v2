import type { Metadata } from "next";
import { HeaderV2 } from "@/components/v2/header-v2";
import { HeroV2 } from "@/components/v2/hero-v2";
import { SocialProof } from "@/components/v2/social-proof";
import { FeaturesV2 } from "@/components/v2/features-v2";
import { Advantages } from "@/components/v2/advantages";
import { HowToStart } from "@/components/v2/how-to-start";
import { BannerCta } from "@/components/v2/banner-cta";
import { PricingV2 } from "@/components/v2/pricing-v2";
import { FaqV2 } from "@/components/v2/faq-v2";
import { FinalCtaV2 } from "@/components/v2/final-cta-v2";
import { FooterV2 } from "@/components/v2/footer-v2";
import { BeamsBackground } from "@/components/ui/beams-background";
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
} from "@/components/json-ld";

export const metadata: Metadata = {
  title: "Tatame — Gestão completa para sua academia de Jiu-Jitsu",
  description:
    "Agenda, check-in, graduações e financeiro em um único app. Teste grátis por 30 dias.",
  alternates: {
    canonical: "https://apptatame.com.br/v2",
  },
};

export default function LandingPageV2() {
  return (
    <>
      <BeamsBackground intensity="subtle" />
      <main className="relative z-10 flex min-h-screen flex-col">
        <OrganizationJsonLd />
        <SoftwareApplicationJsonLd />
        <HeaderV2 />
        <HeroV2 />
        {/* <SocialProof /> */}
        <FeaturesV2 />
        <Advantages />
        <HowToStart />
        <BannerCta />
        <PricingV2 />
        <FaqV2 />
        <FinalCtaV2 />
        <FooterV2 />
      </main>
    </>
  );
}
