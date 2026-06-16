import { HeaderV2 } from "@/components/v2/header-v2";
import { HeroV2 } from "@/components/v2/hero-v2";
import { FeaturesV2 } from "@/components/v2/features-v2";
import { HowToStart } from "@/components/v2/how-to-start";
import { PricingV2 } from "@/components/v2/pricing-v2";
import { FaqV2 } from "@/components/v2/faq-v2";
import { FinalCtaV2 } from "@/components/v2/final-cta-v2";
import { FooterV2 } from "@/components/v2/footer-v2";
import { BeamsBackground } from "@/components/ui/beams-background";
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
} from "@/components/json-ld";

export default function Home() {
  return (
    <>
      <BeamsBackground intensity="subtle" />
      <main className="relative z-10 flex min-h-screen flex-col">
        <OrganizationJsonLd />
        <SoftwareApplicationJsonLd />
        <HeaderV2 />
        <HeroV2 />
        <FeaturesV2 />
        <HowToStart />
        <PricingV2 />
        <FaqV2 />
        <FinalCtaV2 />
        <FooterV2 />
      </main>
    </>
  );
}
