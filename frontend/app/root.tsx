import React from "react";
import {
  isRouteErrorResponse,
  Link,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import { Header } from "~/components/landing/header";
import { MarketMarqueeBanner } from "~/components/market-marquee-banner";
import { Button } from "~/components/landing/button";
import { AppProviders } from "./providers";
import { useAppTheme } from "~/theme-context";
import { useAppTheme } from "~/theme-context";
import "./app.css";

const themeInitScript = `(function(){function s(){try{var r=document.documentElement,t=localStorage.getItem("theme");if(t==="dark"){r.classList.add("dark");r.style.colorScheme="dark";r.dataset.theme="dark";}else{r.classList.remove("dark");r.style.colorScheme="light";r.dataset.theme="light";}}catch(e){}}s();document.addEventListener("click",function(e){var el=e.target&&e.target.closest&&e.target.closest("[data-theme-toggle]");if(!el)return;var r=document.documentElement,n=r.classList.contains("dark")?"light":"dark";if(n==="dark"){r.classList.add("dark");r.style.colorScheme="dark";r.dataset.theme="dark";}else{r.classList.remove("dark");r.style.colorScheme="light";r.dataset.theme="light";}try{localStorage.setItem("theme",n);}catch(err){}window.dispatchEvent(new Event("themechange"));},true);})();`;

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;500;600;700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();

  return (
    <html lang="en" className={theme} data-theme={theme} style={{ colorScheme: theme }} suppressHydrationWarning>
      <html lang="en" className={theme} data-theme={theme} style={{ colorScheme: theme }} suppressHydrationWarning>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <Meta />
          <Links />
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body>
          <AppProviders>{children}</AppProviders>
          <ScrollRestoration />
          <Scripts />
        </body>
      </html>
      );
}

      export default function App() {
  const {pathname} = useLocation();
      const showHeader = ["/", "/pricing", "/about", "/faq"].includes(pathname);

      return (
      <>
        <MarketMarqueeBanner />
        <div
          style={{
            paddingTop: "var(--market-banner-offset, 0px)",
            overflowX: "clip",
          }}
        >
          {showHeader ? <Header /> : null}
          <Outlet />
        </div>
      </>
      );
}

      import {BeamsBackground} from "~/components/landing/beams-background";
      import {LineShadowText} from "~/routes/home/components/line-shadow-text";

      export function ErrorBoundary({error}: Route.ErrorBoundaryProps) {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
        setIsLoggedIn(!!localStorage.getItem("access_token"));
  }, []);

      let message = "Oops!";
      let details = "An unexpected error occurred.";
      let stack: string | undefined;
      const is404 = isRouteErrorResponse(error) && error.status === 404;

      if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? "404" : "Error " + error.status;
      details =
      error.status === 404
      ? "The requested page could not be found."
      : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
        details = error.message;
      stack = error.stack;
  }

      return (
      <BeamsBackground intensity="strong">
        <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6">
          <div className="relative z-10 w-full max-w-4xl text-center">
            <div className="mb-4 flex justify-center">
              <h1 className="text-[10rem] font-black tracking-tighter text-foreground/5 sm:text-[16rem] md:text-[20rem] select-none leading-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                {is404 ? "404" : "Error"}
              </h1>
              <LineShadowText
                className="text-8xl font-black tracking-tighter text-foreground sm:text-[10rem] md:text-[12rem] leading-none relative z-10"
                shadowColor="oklch(0.55 0.22 255)"
              >
                {is404 ? "404" : "ERROR"}
              </LineShadowText>
            </div>

            <div className="relative z-20 space-y-6">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                  {message === "404" ? "Page Not Found" : message}
                </h2>
                <p className="mx-auto max-w-lg text-lg text-muted-foreground/90 dark:text-white/70 leading-relaxed text-balance">
                  {details}
                </p>
              </div>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-8 font-bold shadow-2xl transition-all hover:scale-105 active:scale-95 bg-primary text-primary-foreground dark:bg-white dark:text-black">
                  <Link to={isLoggedIn ? "/dashboard" : "/"}>
                    Return {isLoggedIn ? "to Dashboard" : "to Home"}
                  </Link>
                </Button>
              </div>

              {stack && (
                <div className="mt-16 text-left mx-auto max-w-2xl">
                  <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground/40 font-bold">Trace Log</p>
                  <div className="group relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-meta-blue/20 to-primary/20 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000" />
                    <pre className="relative max-h-48 w-full overflow-auto rounded-xl border border-border/50 bg-background/40 p-5 text-[11px] font-mono text-muted-foreground/80 backdrop-blur-md scrollbar-hide">
                      <code>{stack}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </BeamsBackground>
      );
}
