import { LandingHeader } from "@/components/landing/LandingHeader";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Benefits } from "@/components/landing/Benefits";
import { PricingTeaser } from "@/components/landing/PricingTeaser";
import { FinalCta } from "@/components/landing/FinalCta";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function HomePage() {
  return (
    <>
      <LandingHeader />
      <main>
        <Hero />
        <Marquee />
        <HowItWorks />
        <Benefits />
        <PricingTeaser />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
