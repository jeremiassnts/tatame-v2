import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { Pricing } from "@/components/pricing";
import { FinalCta } from "@/components/final-cta";
import { Faq } from "@/components/faq";

export default function Home() {
  return (
    <main>
      <Hero />
      <Features />
      <Pricing />
      <FinalCta />
      <Faq />
    </main>
  );
}
