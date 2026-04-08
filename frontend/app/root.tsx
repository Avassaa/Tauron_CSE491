import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import { Header } from "~/components/landing/header";
import { AppProviders } from "./providers";
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
  return (
    <html lang="en" suppressHydrationWarning>
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

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
