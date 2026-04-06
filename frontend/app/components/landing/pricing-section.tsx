'use client';

import React from 'react';
import { Link } from 'react-router';
import { Button } from "~/components/landing/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/landing/tooltip";
import { cn } from "~/lib/utils";
import { CheckCircleIcon, StarIcon } from 'lucide-react';
import { motion, type Transition } from 'motion/react';

type FREQUENCY = 'monthly' | 'yearly';
const frequencies: FREQUENCY[] = ['monthly', 'yearly'];

export interface Plan {
  name: string;
  info: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: {
    text: string;
    tooltip?: string;
  }[];
  btn: {
    text: string;
    href: string;
  };
  highlighted?: boolean;
}

export interface PricingSectionProps
  extends Omit<React.ComponentProps<'div'>, 'children'> {
  plans: Plan[];
  heading: string;
  description?: string;
  className?: string;
}

export function PricingSection({
  plans,
  heading,
  description,
  className,
  ...props
}: PricingSectionProps) {
  const [frequency, setFrequency] = React.useState<FREQUENCY>('monthly');

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center space-y-5 p-4',
        className,
      )}
      {...props}
    >
      <div className="mx-auto max-w-xl space-y-2">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
          {heading}
        </h2>
        {description && (
          <p className="text-center text-sm text-foreground/80 md:text-base">
            {description}
          </p>
        )}
      </div>
      <PricingFrequencyToggle
        frequency={frequency}
        setFrequency={setFrequency}
      />
      <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <PricingCard plan={plan} key={plan.name} frequency={frequency} />
        ))}
      </div>
    </div>
  );
}

type PricingFrequencyToggleProps = React.ComponentProps<'div'> & {
  frequency: FREQUENCY;
  setFrequency: React.Dispatch<React.SetStateAction<FREQUENCY>>;
};

export function PricingFrequencyToggle({
  frequency,
  setFrequency,
  className,
  ...props
}: PricingFrequencyToggleProps) {
  const isYearly = frequency === 'yearly';

  return (
    <div
      role="tablist"
      aria-label="Billing period"
      className={cn(
        'relative mx-auto flex w-52 rounded-full border p-1 backdrop-blur-md',
        'border-neutral-200 bg-muted/90',
        'dark:border-white/15 dark:bg-black/50',
        className,
      )}
      {...props}
    >
      <span
        className="absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-6px)] rounded-full bg-background shadow-sm transition-transform duration-200 ease-out dark:bg-white"
        style={{
          transform: isYearly ? 'translateX(calc(100% + 4px))' : 'translateX(0)',
        }}
        aria-hidden
      />
      <button
        type="button"
        role="tab"
        aria-selected={!isYearly}
        onClick={() => setFrequency('monthly')}
        className={cn(
          'relative z-10 flex-1 py-2 text-sm font-medium transition-colors',
          !isYearly
            ? 'text-foreground dark:text-neutral-950'
            : 'text-foreground/70 hover:text-foreground dark:text-white/80 dark:hover:text-white',
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isYearly}
        onClick={() => setFrequency('yearly')}
        className={cn(
          'relative z-10 flex-1 py-2 text-sm font-medium transition-colors',
          isYearly
            ? 'text-foreground dark:text-neutral-950'
            : 'text-foreground/70 hover:text-foreground dark:text-white/80 dark:hover:text-white',
        )}
      >
        Yearly
      </button>
    </div>
  );
}

type PricingCardProps = React.ComponentProps<'div'> & {
  plan: Plan;
  frequency?: FREQUENCY;
};

const cardShell =
  'relative flex w-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-card shadow-sm text-card-foreground dark:border-white/15 dark:bg-zinc-900/80 dark:text-white';

export function PricingCard({
  plan,
  className,
  frequency = frequencies[0],
  ...props
}: PricingCardProps) {
  const cardContent = (
    <>
      <div
        className={cn(
          'relative z-10 rounded-t-xl border-b p-4',
          'border-neutral-200 bg-muted/50',
          'dark:border-white/10 dark:bg-zinc-800/95',
          plan.highlighted && 'dark:bg-zinc-800',
        )}
      >
        <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
          {plan.highlighted && (
            <p
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm',
                'border-neutral-200 bg-muted text-foreground',
                'dark:border-white/15 dark:bg-white/10 dark:text-white dark:shadow-[0_0_18px_rgba(255,255,255,0.08)]',
              )}
            >
              <StarIcon className="h-3 w-3 fill-foreground text-foreground dark:fill-white dark:text-white" />
              Popular
            </p>
          )}
          {frequency === 'yearly' && plan.name !== 'Starter' && (
            <p
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                'border-neutral-200 bg-muted text-foreground',
                'dark:border-white/15 dark:bg-white/10 dark:text-white',
              )}
            >
              {Math.round(
                ((plan.price.monthly * 12 - plan.price.yearly) /
                  (plan.price.monthly * 12)) *
                  100,
              )}
              % off
            </p>
          )}
        </div>

        <div className="text-lg font-semibold text-foreground dark:text-white">
          {plan.name}
        </div>
        <p className="text-sm font-normal text-foreground/90 dark:text-white/85">
          {plan.info}
        </p>
        <h3 className="mt-2 flex items-end gap-1">
          <span className="text-3xl font-bold text-foreground dark:text-white">
            ${plan.price[frequency]}
          </span>
          <span className="text-foreground/80 dark:text-white/80">
            {plan.name !== 'Starter'
              ? '/' + (frequency === 'monthly' ? 'month' : 'year')
              : ''}
          </span>
        </h3>
      </div>
      <div
        className={cn(
          'relative z-10 space-y-4 px-4 py-6 text-sm',
          'text-foreground',
          'bg-background/80 dark:bg-zinc-900/60 dark:text-white/90',
          plan.highlighted && 'dark:bg-zinc-900/80',
        )}
      >
        {plan.features.map((feature, index) => (
          <div key={index} className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 shrink-0 text-foreground/80 dark:text-white/80" />
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <p
                    className={cn(
                      feature.tooltip &&
                        'cursor-pointer border-b border-dashed border-neutral-300 dark:border-white/30',
                    )}
                  >
                    {feature.text}
                  </p>
                </TooltipTrigger>
                {feature.tooltip && (
                  <TooltipContent>
                    <p>{feature.tooltip}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}
      </div>
      <div
        className={cn(
          'relative z-10 mt-auto w-full rounded-b-xl border-t p-3',
          'border-neutral-200 bg-muted/40',
          'dark:border-white/10 dark:bg-zinc-900/60',
          plan.highlighted && 'dark:bg-zinc-900/80',
        )}
      >
        <Button
          className={cn(
            'w-full cursor-pointer transition-colors',
            'border-neutral-200 bg-background text-foreground shadow-none',
            'hover:bg-accent hover:text-accent-foreground',
            'dark:border-white/15 dark:bg-transparent dark:text-white',
            'dark:hover:bg-white/10 dark:hover:text-white',
          )}
          variant="outline"
          asChild
        >
          <Link to={plan.btn.href}>Select package</Link>
        </Button>
      </div>
    </>
  );

  if (plan.highlighted) {
    return (
      <div className={cn(cardShell, className)} {...props}>
        <BorderTrail
          size={80}
          className="rounded-[inherit] bg-primary shadow-[0_0_14px_rgba(0,0,0,0.15)] dark:bg-white dark:shadow-[0_0_14px_rgba(255,255,255,0.9)]"
          transition={{ duration: 4, ease: 'linear', repeat: Infinity }}
        />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {cardContent}
        </div>
      </div>
    );
  }

  return (
    <div key={plan.name} className={cn(cardShell, className)} {...props}>
      {cardContent}
    </div>
  );
}

type BorderTrailProps = {
  className?: string;
  size?: number;
  transition?: Transition;
  delay?: number;
  onAnimationComplete?: () => void;
  style?: React.CSSProperties;
};

export function BorderTrail({
  className,
  size = 60,
  transition,
  delay,
  onAnimationComplete,
  style,
}: BorderTrailProps) {
  const baseTransition = {
    repeat: Infinity,
    duration: 5,
    ease: 'linear',
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:border-box,content-box] [mask-composite:exclude] [mask-image:linear-gradient(#000,#000),linear-gradient(#000,#000)]"
      aria-hidden
      style={{ padding: 2, ...style }}
    >
      <motion.div
        className={cn('absolute aspect-square', className)}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          ...style,
        }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={{ ...(transition ?? baseTransition), delay }}
        onAnimationComplete={onAnimationComplete}
      />
    </div>
  );
}

export const DEFAULT_PRICING_PLANS: Plan[] = [
  {
    name: 'Starter',
    info: 'Basic Analytics',
    price: { monthly: 0, yearly: 0 },
    features: [
      {
        text: 'Core technical indicators: RSI, MACD, and moving averages for BTC & ETH.',
      },
      {
        text: 'Real-time price tracking: live OHLCV via the Binance API.',
      },
      {
        text: 'Daily forecast summary: directional signals based on 4-hour candles.',
      },
      {
        text: 'Standard dashboard: a basic portfolio view with a modern Angular 17 UI.',
      },
    ],
    btn: { text: 'Select package', href: '/signup' },
  },
  {
    name: 'Pro',
    info: 'Advanced Forecasting',
    price: { monthly: 20, yearly: 200 },
    highlighted: true,
    features: [
      {
        text: 'FinBERT sentiment analysis: sentiment scores from news & social media with 0.68 correlation.',
      },
      {
        text: 'Hybrid LSTM-GRU models: forecasts that capture short-term momentum shifts with 14% lower error.',
      },
      {
        text: 'Live signal notifications: real-time Buy/Sell/Hold alerts over WebSocket.',
      },
      {
        text: 'Advanced charting tools: overlay technical data and sentiment scores.',
      },
    ],
    btn: { text: 'Select package', href: '/signup?plan=pro' },
  },
  {
    name: 'Enterprise',
    info: 'Full Control',
    price: { monthly: 50, yearly: 500 },
    features: [
      {
        text: 'On-chain network metrics: NVT ratio and exchange net inflow/outflow data (Glassnode integration).',
      },
      {
        text: 'Macroeconomic data: global liquidity and inflation indicators via FRED.',
      },
      {
        text: 'Unlimited backtesting: test strategies with Sharpe Ratio and Max Drawdown metrics.',
      },
      {
        text: 'Priority model access: latest weights with hot-swapped models and up-to-date datasets.',
      },
    ],
    btn: { text: 'Select package', href: '/contact' },
  },
];
