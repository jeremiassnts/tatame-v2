import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { Pricing } from "@/components/pricing";
import { Faq } from "@/components/faq";
import { FinalCta } from "@/components/final-cta";
import { Footer } from "@/components/footer";
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
} from "@/components/json-ld";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <OrganizationJsonLd />
      <SoftwareApplicationJsonLd />
      <Header />
      <Hero />
      <Features />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  );
}
