"use client"

import { useNavigate } from "react-router"
import {
  PricingSection,
  DEFAULT_PRICING_PLANS,
  type Plan,
} from "~/components/landing/pricing-section"

export default function PricingPage() {
  const navigate = useNavigate()

  function handleSelectPlan(plan: Plan) {
    // Any plan selection redirects to login
    void navigate("/login")
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16 md:py-20">
      <PricingSection
        plans={DEFAULT_PRICING_PLANS}
        heading="Pricing"
        description="Choose the plan that fits your needs."
        onSelectPlan={handleSelectPlan}
      />
    </main>
  )
}

