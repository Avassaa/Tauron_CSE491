import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";

interface SubscriptionPlan {
  name: string;
  price: string;
  features: string[];
  selected: boolean;
}

@Component({
  selector: "app-subscription",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./subscription.component.html",
  styleUrl: "./subscription.component.scss",
})
export class SubscriptionComponent {
  user = {
    firstName: "Test",
    lastName: "User",
    currentPlan: "Premium",
  };

  expandedPlan: string | null = null;

  subscriptionPlans: SubscriptionPlan[] = [
    {
      name: "Basic",
      price: "$0/mo",
      features: [
        "Basic Wallet Management",
        "Daily News Summary",
        "Limited Transactions",
        "Standard Security",
      ],
      selected: true,
    },
    {
      name: "Pro",
      price: "$9.99/mo",
      features: [
        "Advanced Wallet Tools",
        "Personalized News Feed",
        "Unlimited Transactions",
        "Enhanced Security",
      ],
      selected: false,
    },
    {
      name: "Business",
      price: "$39.99/mo",
      features: [
        "Full Business Suite",
        "Custom News & Analytics",
        "Priority Processing",
        "Dedicated Support",
      ],
      selected: false,
    },
  ];

  toggleExpand(planName: string): void {
    this.expandedPlan = this.expandedPlan === planName ? null : planName;
  }

  selectPlan(plan: SubscriptionPlan): void {
    this.subscriptionPlans.forEach((p) => (p.selected = false));
    plan.selected = true;
    this.user.currentPlan = plan.name;
  }
}
