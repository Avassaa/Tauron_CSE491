'use client'

import { BeamsBackground } from "~/components/landing/beams-background"

interface AnnouncementBanner {
  text: string
  linkText: string
  linkHref: string
}

interface CallToAction {
  text: string
  href: string
  variant: 'primary' | 'secondary'
}

interface HeroLandingProps {
  title: string
  description: string
  announcementBanner?: AnnouncementBanner
  callToActions?: CallToAction[]
  titleSize?: 'small' | 'medium' | 'large'
  className?: string
  /** When true, do not wrap in BeamsBackground (parent provides it for continuous background). */
  embedInBackground?: boolean
}

const defaultProps: Partial<HeroLandingProps> = {
  titleSize: "large",
  callToActions: [
    { text: "Get started", href: "#", variant: "primary" },
    { text: "Learn more", href: "#", variant: "secondary" }
  ]
}

export function HeroLanding(props: HeroLandingProps) {
  const {
    title,
    description,
    announcementBanner,
    callToActions,
    titleSize,
    className,
    embedInBackground = false,
  } = { ...defaultProps, ...props }

  const getTitleSizeClasses = () => {
    switch (titleSize) {
      case 'small':
        return 'text-2xl sm:text-3xl md:text-5xl'
      case 'medium':
        return 'text-2xl sm:text-4xl md:text-6xl'
      case 'large':
      default:
        return 'text-3xl sm:text-5xl md:text-7xl'
    }
  }

  const renderCallToAction = (cta: CallToAction, index: number) => {
    if (cta.variant === 'primary') {
      return (
        <a
          key={index}
          href={cta.href}
          className="rounded-lg bg-primary px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors"
        >
          {cta.text}
        </a>
      )
    } else {
      return (
        <a
          key={index}
          href={cta.href}
          className="text-xs sm:text-sm/6 font-semibold text-foreground hover:text-muted-foreground transition-colors"
        >
          {cta.text} <span aria-hidden="true">→</span>
        </a>
      )
    }
  }

  const inner = (
    <div className="relative min-h-screen w-screen overflow-x-hidden text-foreground dark:text-white [&_a]:text-foreground/90 dark:[&_a]:text-white/90 [&_a:hover]:text-foreground dark:[&_a:hover]:text-white [&_a.rounded-lg.bg-primary]:bg-primary [&_a.rounded-lg.bg-primary]:text-primary-foreground [&_a.rounded-lg.bg-primary:hover]:bg-primary/90">
      <div className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden px-6 pt-0">
        <div className="mx-auto max-w-4xl pt-10 sm:pt-12">
          {announcementBanner && (
            <div className="hidden sm:mb-2 sm:flex sm:justify-center">
              <div className="relative rounded-full px-2 py-1 text-xs text-muted-foreground ring-1 ring-border transition-all hover:ring-border/80 dark:text-white/70 dark:ring-white/20 dark:hover:ring-white/40 sm:px-3 sm:text-sm/6">
                {announcementBanner.text}{' '}
                <a href={announcementBanner.linkHref} className="font-semibold text-foreground transition-colors hover:text-foreground/80 dark:text-white dark:hover:text-white/80">
                  <span aria-hidden="true" className="absolute inset-0" />
                  {announcementBanner.linkText} <span aria-hidden="true">&rarr;</span>
                </a>
              </div>
            </div>
          )}

          <div className="text-center">
            <h1 className={`${getTitleSizeClasses()} font-semibold tracking-tight text-balance text-foreground dark:text-white`}>
              {title}
            </h1>
            <p className="mt-6 text-base font-medium text-pretty text-muted-foreground sm:mt-8 sm:text-lg sm:text-xl/8 dark:text-white/80">
              {description}
            </p>

            {callToActions && callToActions.length > 0 && (
              <div className="mt-8 sm:mt-10 flex items-center justify-center gap-x-4 sm:gap-x-6">
                {callToActions.map((cta, index) => renderCallToAction(cta, index))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (embedInBackground) {
    return inner;
  }

  return (
    <BeamsBackground intensity="medium" className={className}>
      {inner}
    </BeamsBackground>
  );
}

export type { HeroLandingProps, AnnouncementBanner, CallToAction }
