import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
    index("routes/home/page/home.tsx"),
    route("pricing", "routes/pricing/page/pricing.tsx"),
    route("about", "routes/about/page/about.tsx"),
    route("login", "routes/login.tsx"),
    route("dashboard", "routes/dashboard.tsx"),
] satisfies RouteConfig;
