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
  onSelectPlan?: (plan: Plan) => void;
  currentPlan?: string;
  isLiquidGlass?: boolean;
}

export function PricingSection({
  plans,
  heading,
  description,
  className,
  onSelectPlan,
  currentPlan,
  isLiquidGlass = true,
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
      {(heading || description) && (
        <div className="mx-auto max-w-xl space-y-2">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 md:text-3xl lg:text-4xl dark:text-white">
            {heading}
          </h2>
          {description && (
            <p className="text-center text-sm text-slate-600 md:text-base dark:text-white/70">
              {description}
            </p>
          )}
        </div>
      )}
      <PricingFrequencyToggle
        frequency={frequency}
        setFrequency={setFrequency}
      />
      <div className="w-full grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PricingCard
            plan={plan}
            key={plan.name}
            frequency={frequency}
            onSelect={onSelectPlan ? () => onSelectPlan(plan) : undefined}
            isCurrentPlan={
              currentPlan !== undefined &&
              (
                (currentPlan === 'free' && plan.name === 'Free') ||
                (currentPlan === 'pro' && plan.name === 'Pro') ||
                (currentPlan === 'ultra' && plan.name === 'Ultra')
              )
            }
            isLiquidGlass={isLiquidGlass}
          />
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
        'relative mx-auto flex w-52 rounded-full border p-1 backdrop-blur-md transition-colors duration-300',
        'border-slate-400 bg-slate-100 shadow-sm',
        'dark:border-white/20 dark:bg-white/10 dark:shadow-md',
        className,
      )}
      {...props}
    >
      <span
        className="absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-6px)] rounded-full bg-slate-900 shadow-sm transition-transform duration-200 ease-out dark:bg-white/30"
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
          'relative z-10 flex-1 py-2 text-sm font-medium transition-colors duration-200',
          !isYearly
            ? 'text-white dark:text-white'
            : 'text-slate-600 hover:text-slate-800 dark:text-white/60 dark:hover:text-white/80',
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
          'relative z-10 flex-1 py-2 text-sm font-medium transition-colors duration-200',
          isYearly
            ? 'text-white dark:text-white'
            : 'text-slate-600 hover:text-slate-800 dark:text-white/60 dark:hover:text-white/80',
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
  onSelect?: () => void;
  isCurrentPlan?: boolean;
  isLiquidGlass?: boolean;
};

const cardShell =
  'relative flex w-full flex-col overflow-hidden rounded-2xl border text-card-foreground transition-all duration-300 lg:hover:shadow-md';

export function PricingCard({
  plan,
  className,
  frequency = frequencies[0],
  onSelect,
  isCurrentPlan,
  isLiquidGlass = true,
  ...props
}: PricingCardProps) {
  const cardContent = (
    <>
      <div
        className={cn(
          'relative z-10 rounded-t-2xl border-b p-4 transition-colors duration-300',
          isLiquidGlass
            ? 'border-slate-300 bg-white/8 backdrop-blur-md lg:bg-white/5 dark:border-white/20 dark:bg-white/10 dark:backdrop-blur-md'
            : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900',
          plan.highlighted && isLiquidGlass && 'border-slate-400 dark:bg-white/15 dark:border-white/30',
          plan.highlighted && !isLiquidGlass && 'border-slate-400 dark:bg-slate-800',
        )}
      >
        <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
          {plan.highlighted && (
            <p
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm transition-colors duration-300',
                isLiquidGlass
                  ? 'border-slate-500 bg-slate-100 text-slate-900 dark:border-white/40 dark:bg-white/20 dark:text-white'
                  : 'border-slate-400 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white',
              )}
            >
              <StarIcon className="h-3 w-3 fill-current text-current" />
              Popular
            </p>
          )}
          {frequency === 'yearly' && plan.name !== 'Free' && (
            <p
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors duration-300',
                isLiquidGlass
                  ? 'border-slate-400 bg-slate-100 text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white'
                  : 'border-slate-400 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white',
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

        <div className="text-lg font-semibold text-slate-900 dark:text-white">
          {plan.name}
        </div>
        <p className="text-sm font-normal text-slate-700 dark:text-white/90">
          {plan.info}
        </p>
        <h3 className="mt-2 flex items-end gap-1">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">
            ${plan.price[frequency]}
          </span>
          <span className="text-slate-600 dark:text-white/70">
            {plan.name !== 'Free' ? '/' + (frequency === 'monthly' ? 'month' : 'year') : ''}
          </span>
        </h3>
      </div>
      <div
        className={cn(
          'relative z-10 flex-1 space-y-4 px-4 py-6 text-sm transition-colors duration-300',
          'text-slate-900',
          isLiquidGlass
            ? 'bg-white/3 backdrop-blur-sm dark:bg-white/5 dark:text-white/95'
            : 'bg-white dark:bg-slate-850 dark:text-slate-100',
          plan.highlighted && isLiquidGlass && 'dark:bg-white/8',
          plan.highlighted && !isLiquidGlass && 'dark:bg-slate-800',
        )}
      >
        {plan.features.map((feature, index) => (
          <div key={index} className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 shrink-0 text-slate-600 dark:text-white/70" />
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <p
                    className={cn(
                      'text-slate-700 dark:text-white/95',
                      feature.tooltip &&
                        'cursor-pointer border-b border-dashed border-slate-400 dark:border-white/30',
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
          'relative z-10 mt-auto w-full rounded-b-2xl border-t p-3 transition-colors duration-300',
          isLiquidGlass
            ? 'border-slate-300 bg-white/5 dark:border-white/20 dark:bg-white/8'
            : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900',
          plan.highlighted && isLiquidGlass && 'dark:bg-white/15 dark:border-white/30',
          plan.highlighted && !isLiquidGlass && 'dark:bg-slate-800',
        )}
      >
        {onSelect ? (
          <Button
            className={cn(
              'w-full cursor-pointer transition-all font-bold duration-300',
              isCurrentPlan
                ? isLiquidGlass
                  ? 'border-slate-400 bg-slate-100 text-slate-900 pointer-events-none dark:border-white/40 dark:bg-white/15 dark:text-white'
                  : 'border-slate-400 bg-slate-100 text-slate-900 pointer-events-none dark:border-slate-600 dark:bg-slate-700 dark:text-white'
                : isLiquidGlass
                ? [
                    'border-slate-400 bg-white/30 text-slate-900 shadow-sm backdrop-blur-sm',
                    'hover:bg-white/40 hover:border-slate-500 hover:shadow-md',
                    'dark:border-white/30 dark:bg-white/15 dark:text-white',
                    'dark:hover:bg-white/20 dark:hover:border-white/40',
                  ]
                : [
                    'border-slate-400 bg-white text-slate-900 shadow-sm',
                    'hover:bg-slate-50 hover:border-slate-500 hover:shadow-md',
                    'dark:border-slate-600 dark:bg-slate-800 dark:text-white',
                    'dark:hover:bg-slate-700 dark:hover:border-slate-500',
                  ],
            )}
            variant="outline"
            onClick={onSelect}
            disabled={isCurrentPlan}
          >
            {isCurrentPlan ? 'Current plan' : 'Select package'}
          </Button>
        ) : (
          <Button
            className={cn(
              'w-full cursor-pointer transition-all font-bold duration-300',
              isLiquidGlass
                ? 'border-slate-400 bg-white/30 text-slate-900 shadow-sm backdrop-blur-sm dark:border-white/30 dark:bg-white/15 dark:text-white dark:hover:bg-white/20'
                : 'border-slate-400 bg-white text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 hover:bg-slate-50 hover:shadow-md hover:border-slate-500',
            )}
            variant="outline"
            asChild
          >
            <Link to={plan.btn.href}>Select package</Link>
          </Button>
        )}
      </div>
    </>
  );

  if (plan.highlighted) {
    const highlightedShell = cn(
      cardShell,
      isLiquidGlass
        ? 'border-slate-500 shadow-[0_8px_32px_rgba(15,23,42,0.12)] lg:shadow-[0_8px_32px_rgba(15,23,42,0.15)] dark:border-white/40 dark:shadow-[0_8px_32px_rgba(255,255,255,0.15)]'
        : 'border-slate-500 shadow-lg dark:border-slate-600 dark:shadow-lg',
      className,
    );
    
    return (
      <div className={highlightedShell} {...props}>
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

  const normalShell = cn(
    cardShell,
    isLiquidGlass
      ? 'border-slate-400 shadow-[0_8px_32px_rgba(15,23,42,0.08)] dark:border-white/25 dark:shadow-[0_8px_32px_rgba(255,255,255,0.08)]'
      : 'border-slate-400 shadow-sm dark:border-slate-700 dark:shadow-md',
    className,
  );

  return (
    <div className={normalShell} {...props}>
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
    name: 'Free',
    info: 'Basic Analytics',
    price: { monthly: 0, yearly: 0 },
    features: [
      { text: 'Core technical indicators: RSI, MACD, and moving averages for BTC & ETH.' },
      { text: 'Real-time price tracking: live OHLCV via the Binance API.' },
      { text: 'Daily forecast summary: directional signals based on 4-hour candles.' },
      { text: 'Standard dashboard with live market view.' },
    ],
    btn: { text: 'Select package', href: '/signup' },
  },
  {
    name: 'Pro',
    info: 'AI-Powered Predictions',
    price: { monthly: 20, yearly: 200 },
    highlighted: true,
    features: [
      {
        text: 'AI price predictions: Buy/Sell/Hold signals powered by hybrid LSTM-GRU models.',
        tooltip: 'Models trained on historical market data and on-chain metrics.',
      },
      { text: 'FinBERT sentiment analysis: sentiment scores from news & social media with 0.68 correlation.' },
      { text: 'Live signal notifications: real-time Buy/Sell/Hold alerts over WebSocket.' },
      { text: 'Advanced charting tools: overlay technical data and sentiment scores.' },
    ],
    btn: { text: 'Select package', href: '/signup?plan=pro' },
  },
  {
    name: 'Ultra',
    info: 'Train Your Own Model',
    price: { monthly: 50, yearly: 500 },
    features: [
      {
        text: 'Custom model training: train your own model on selected assets with configurable parameters.',
        tooltip: 'Set training schedules, choose feature sets, and download model weights.',
      },
      { text: 'On-chain network metrics: NVT ratio and exchange net inflow/outflow data (Glassnode integration).' },
      { text: 'Unlimited backtesting: test strategies with Sharpe Ratio and Max Drawdown metrics.' },
      { text: 'Priority model access: latest weights with hot-swapped models and up-to-date datasets.' },
    ],
    btn: { text: 'Select package', href: '/signup?plan=ultra' },
  },
];
