"""API v1 routes."""

from .assets import router as assets_router
from .auth import router as auth_router
from .backtest_results import router as backtest_results_router
from .chat_history import admin_router as chat_history_admin_router
from .chat_history import router as chat_history_router
from .comment_images import router as comment_images_router
from .curated_news import router as curated_news_router
from .health import router as health_router
from .knowledge_base import router as knowledge_base_router
from .market_data import router as market_data_router
from .ml_models import router as ml_models_router
from .ml_training import router as ml_training_router
from .news_scrape import router as news_scrape_router
from .notifications import admin_router as notifications_admin_router
from .notifications import router as notifications_router
from .on_chain_metrics import router as on_chain_metrics_router
from .price_alerts import router as price_alerts_router
from .predictions import router as predictions_router
from .scraper_logs import router as scraper_logs_router
from .technical_indicators import router as technical_indicators_router
from .users import router as users_router
from .watchlists import router as watchlists_router
from .watchlist_lists import router as watchlist_lists_router

__all__ = [
    "assets_router",
    "auth_router",
    "backtest_results_router",
    "chat_history_admin_router",
    "chat_history_router",
    "comment_images_router",
    "curated_news_router",
    "health_router",
    "knowledge_base_router",
    "market_data_router",
    "ml_models_router",
    "ml_training_router",
    "news_scrape_router",
    "notifications_router",
    "notifications_admin_router",
    "on_chain_metrics_router",
    "price_alerts_router",
    "predictions_router",
    "scraper_logs_router",
    "technical_indicators_router",
    "users_router",
    "watchlists_router",
    "watchlist_lists_router",
]
