### 0. Dependencies

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1. The Core Reference Tables

#### Table: `assets`
*Stores the master list of cryptocurrencies.*
```sql
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50), -- Layer1, DeFi, Stablecoin
    coingecko_id VARCHAR(100), -- For cross-referencing APIs
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```
*   **Population:** Seeded manually or via a script using the CoinGecko/Binance API list.
*   **Logic:** Every other table (Price, Metrics, News) links to this `id`.

#### Table: `users`
*Stores user accounts and AI preferences.*
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    preferences JSONB DEFAULT '{"theme": "dark", "currency": "USD", "risk_level": "medium"}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```
*   **Logic:** The `preferences` JSONB stores settings like "preferred technical indicators" for the Chatbot to prioritize.

---

### 2. Market & Quant Tables (TimescaleDB)

#### Table: `market_data`
*Standard OHLCV data.*
```sql
CREATE TABLE market_data (
    time TIMESTAMPTZ NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(id),
    open NUMERIC NOT NULL,
    high NUMERIC NOT NULL,
    low NUMERIC NOT NULL,
    close NUMERIC NOT NULL,
    volume NUMERIC NOT NULL,
    resolution VARCHAR(5) NOT NULL, -- 1m, 1h, 1d
    PRIMARY KEY (time, asset_id)
);
SELECT create_hypertable('market_data', 'time');
```
*   **Population:** Python Scraper (Binance/Kraken API). Runs every 1m or 1h.
*   **Logic:** The `resolution` allows you to store different timeframes in the same table structure.

#### Table: `technical_indicators`
*Calculated metrics (RSI, MACD, etc.).*
```sql
CREATE TABLE technical_indicators (
    time TIMESTAMPTZ NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(id),
    indicator_name VARCHAR(50) NOT NULL,
    value NUMERIC NOT NULL,
    PRIMARY KEY (time, asset_id, indicator_name)
);
SELECT create_hypertable('technical_indicators', 'time');
```
*   **Population:** A "Worker" script. After `market_data` is inserted, this script runs **TA-Lib**, calculates metrics, and inserts them here.
*   **Logic:** Separating this from price data makes "Multi-metric comparison" queries much faster.

#### Table: `on_chain_metrics`
*Blockchain-specific data.*
```sql
CREATE TABLE on_chain_metrics (
    time TIMESTAMPTZ NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(id),
    metric_name VARCHAR(50) NOT NULL, -- ExchangeNetflow, ActiveAddresses
    value NUMERIC NOT NULL,
    PRIMARY KEY (time, asset_id, metric_name)
);
SELECT create_hypertable('on_chain_metrics', 'time');
```
*   **Population:** Scraper (Glassnode/CryptoQuant). Usually updated daily or hourly.

---

### 3. AI & Knowledge Pillar (pgvector)

#### Table: `knowledge_base`
*The source for the Chatbot’s "Grounding" (RAG).*
```sql
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id), -- Optional: can be null for general macro news
    source_type VARCHAR(20), -- twitter, news, whitepaper, blog
    title TEXT,
    content TEXT NOT NULL,
    url TEXT,
    embedding VECTOR(1536), -- Standard size for OpenAI Ada-002 / text-embedding-3
    published_at TIMESTAMPTZ NOT NULL,
    metadata JSONB -- Original tweet ID, author, hashtags
);
CREATE INDEX ON knowledge_base USING hnsw (embedding vector_l2_ops);
```
*   **Population:** News Scraper (Twitter API / News RSS). Python script chunks the text and gets embeddings from OpenAI/HuggingFace before insert.
*   **Logic:** Chatbot queries this using Vector Search to answer questions like *"What is the sentiment on Twitter about the recent ETH upgrade?"*

#### Table: `curated_news`
*The AI-synthesized hourly analysis.*
```sql
CREATE TABLE curated_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id),
    summary TEXT NOT NULL,
    sentiment_score FLOAT, -- -1 to 1
    data_points_used JSONB, -- The Evidence Map (Ref IDs to indicators/prices)
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```
*   **Population:** **Cron Job (Hourly).** Pulls last 1h of data $\rightarrow$ LLM Synthesis $\rightarrow$ Insert.
*   **Logic:** `data_points_used` allows the frontend to draw the exact charts the AI used to make its conclusion.

#### Table: `news_data`
*Raw articles from site scrapers (same field names as JSON: `source`, `scrapedAt`, `publishedAt`, `title`, `content`).*
```sql
CREATE TABLE news_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fingerprint VARCHAR(64) NOT NULL,
    source VARCHAR(64) NOT NULL,
    scraped_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,
    title TEXT,
    content TEXT NOT NULL DEFAULT '',
    CONSTRAINT uq_news_data_fingerprint UNIQUE (fingerprint)
);
CREATE INDEX ix_news_data_source_scraped_at ON news_data (source, scraped_at);
```
*   **Population:** Scraper batch jobs / merged scraper JSON ingest (map camelCase JSON keys to snake_case columns).
*   **Logic:** Append-only store for RAG or downstream curation; optional dedupe in application code.

---

### 4. Strategy & Prediction Pillar

#### Table: `ml_models`
*Version control for your LSTM/GRU models.*
```sql
CREATE TABLE ml_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id),
    version_tag VARCHAR(50) NOT NULL,
    model_type VARCHAR(20), -- LSTM, GRU, XGBoost
    hyperparameters JSONB,
    training_metrics JSONB, -- Accuracy, F1-Score
    file_path TEXT, -- S3 link or local path to .pth/.h5 file
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```
*   **Logic:** The Chatbot looks for the `is_active = TRUE` model for a specific asset to generate predictions.

#### Table: `predictions`
*Future price forecasts.*
```sql
CREATE TABLE predictions (
    time TIMESTAMPTZ NOT NULL, -- Target time of prediction
    asset_id UUID NOT NULL REFERENCES assets(id),
    model_id UUID NOT NULL REFERENCES ml_models(id),
    predicted_value NUMERIC NOT NULL,
    confidence_interval_high NUMERIC,
    confidence_interval_low NUMERIC,
    PRIMARY KEY (time, asset_id, model_id)
);
SELECT create_hypertable('predictions', 'time');
```

#### Table: `backtest_results`
*Proof of strategy performance.*
```sql
CREATE TABLE backtest_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    model_id UUID REFERENCES ml_models(id),
    strategy_name VARCHAR(100),
    total_return NUMERIC,
    sharpe_ratio NUMERIC,
    max_drawdown NUMERIC,
    trades_log JSONB, -- Detailed list of every Buy/Sell event
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 5. Application & Interaction Pillar

#### Table: `chat_history`
*For persistent AI memory and charting.*
```sql
CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    session_id UUID NOT NULL,
    role VARCHAR(10) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    ui_payload JSONB, -- Store chart data returned by LLM
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```
*   **Logic:** If `ui_payload` contains `{ "type": "comparison_chart", "data": [...] }`, the frontend renders a Chart component instead of plain text.

#### Table: `watchlists`
```sql
CREATE TABLE watchlists (
    user_id UUID REFERENCES users(id),
    asset_id UUID REFERENCES assets(id),
    PRIMARY KEY (user_id, asset_id)
);
```

#### Table: `scraper_logs`
*System Health Monitor.*
```sql
CREATE TABLE scraper_logs (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(50),
    status VARCHAR(20), -- SUCCESS, ERROR
    error_msg TEXT,
    rows_affected INTEGER,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);
```