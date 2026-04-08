import {
  isRouteErrorResponse,
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
import { Button } from "~/components/ui/button";
import { AppProviders } from "./providers";
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
  const { pathname } = useLocation();
  const showHeader = pathname !== "/login" && pathname !== "/signup" && pathname !== "/dashboard";

  return (
    <>
      {showHeader ? <Header /> : null}
      <Outlet />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  let is404 = false;

  if (isRouteErrorResponse(error)) {
    is404 = error.status === 404;
    message = is404 ? "404" : "Error";
    details = is404
      ? "You seem lost. This page may have been removed, renamed, or is temporarily unavailable."
      : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background overflow-hidden relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/5 rounded-[100%] blur-[80px] -z-10" />

      <div className="text-center relative z-10 w-full max-w-2xl px-4">
        {is404 ? (
          <>
            <h1 className="text-[8rem] sm:text-[14rem] font-black tracking-tighter text-primary/10 leading-none select-none">
              404
            </h1>
            <div className="-mt-12 sm:-mt-20 space-y-6">
              <h2 className="text-3xl font-bold tracking-tight sm:text-5xl text-foreground">
                Page Not Found
              </h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto text-balance">
                {details}
              </p>
              <div className="pt-4">
                <Button asChild size="lg" className="rounded-full px-8 shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
                  <Link to="/">Return to Home</Link>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-5xl font-bold text-destructive">{message}</h1>
            <p className="text-lg text-muted-foreground">{details}</p>
            {stack && (
              <pre className="w-full text-left p-4 bg-muted rounded-lg overflow-x-auto text-sm text-muted-foreground mt-8">
                <code>{stack}</code>
              </pre>
            )}
            <div className="pt-6">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/">Return to Home</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
