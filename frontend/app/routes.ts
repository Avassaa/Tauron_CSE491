import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
    index("routes/home/page/home.tsx"),
    route("pricing", "routes/pricing/page/pricing.tsx"),
    route("faq", "routes/faq/page/faq.tsx"),
    route("about", "routes/about/page/about.tsx"),
    route("login", "routes/login.tsx"),
    route("register", "routes/register.tsx"),
    route("forgot-password", "routes/forgot-password.tsx"),
    route("reset-password", "routes/reset-password.tsx"),
    route("dashboard", "routes/dashboard.tsx"),
    route("profile", "routes/profile.tsx"),
    route("profile/edit", "routes/profile-edit.tsx"),
    route("settings", "routes/settings.tsx"),
    route("tools", "routes/tools.tsx"),
    route("notifications", "routes/notifications.tsx"),
    route("assets", "routes/assets.tsx"),
    route("watchlists", "routes/watchlists.tsx"),
    route("news", "routes/news.tsx"),
] satisfies RouteConfig;
