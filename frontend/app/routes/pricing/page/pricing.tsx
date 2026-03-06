'use client';

import { PricingSection, DEFAULT_PRICING_PLANS } from '@/components/pricing-section';

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16 md:py-20">
      <PricingSection
        plans={DEFAULT_PRICING_PLANS}
        heading="Pricing"
        description="Choose the plan that fits your needs."
      />
    </main>
  );
}

