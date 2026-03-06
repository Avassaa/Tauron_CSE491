import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
    index("routes/home/page/home.tsx"),
    route("pricing", "routes/pricing/page/pricing.tsx"),
    route("about", "routes/about/page/about.tsx"),
] satisfies RouteConfig;
