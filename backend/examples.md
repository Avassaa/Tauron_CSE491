### 1. Core Reference Tables

#### `assets` (The Foundation)
| id (UUID) | symbol | name | category | coingecko_id | is_active |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `550e8400-e29b-41d4-a716-446655440000` | BTC | Bitcoin | Layer 1 | bitcoin | true |
| `660e8400-e29b-41d4-a716-446655441111` | ETH | Ethereum | Layer 1 | ethereum | true |

#### `users` (App Logic)
| id (UUID) | username | email | password_hash | preferences (JSONB) |
| :--- | :--- | :--- | :--- | :--- |
| `a1b2c3d4...` | tauron_tester | test@tauron.ai | `$2b$12$...` | `{"theme": "dark", "fav_indicators": ["RSI", "MACD"]}` |

---

### 2. Market & Quant Tables (TimescaleDB)

#### `market_data` (From Scraper)
| time | asset_id | open | high | low | close | volume | resolution |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `2025-05-10 10:00:00` | `...0000` (BTC) | 65200.50 | 65450.00 | 65100.00 | 65320.10 | 1250.5 | 1h |

#### `technical_indicators` (From Worker Script)
| time | asset_id | indicator_name | value |
| :--- | :--- | :--- | :--- |
| `2025-05-10 10:00:00` | `...0000` (BTC) | RSI | 32.5 |
| `2025-05-10 10:00:00` | `...0000` (BTC) | MACD_Signal | -145.2 |

#### `on_chain_metrics` (From Glassnode/CryptoQuant)
| time | asset_id | metric_name | value |
| :--- | :--- | :--- | :--- |
| `2025-05-10 10:00:00` | `...0000` (BTC) | ExchangeNetflow | -45000000 |
| `2025-05-10 10:00:00` | `...1111` (ETH) | ActiveAddresses | 542000 |

---

### 3. AI & Knowledge Pillar (pgvector)

#### `knowledge_base` (From Twitter/News Scraper)
*Note: Embedding is shortened for brevity.*
| id | asset_id | source_type | content | embedding | published_at |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `k-111` | `...0000` | twitter | "BTC ETF inflows hit record high today, bullish sentiment." | `[0.12, -0.04, 0.88, ...]` | `2025-05-10 09:45:00` |

#### `curated_news` (From Hourly Cron Job)
| id | asset_id | summary | sentiment_score | data_points_used (JSONB) |
| :--- | :--- | :--- | :--- | :--- |
| `c-222` | `...0000` | BTC is showing a bullish divergence as exchange outflows increase despite the minor price drop. | 0.75 | `{"price": 65320, "rsi": 32.5, "netflow": -45000000, "sources": ["k-111"]}` |

---

### 4. Strategy & Prediction Pillar

#### `ml_models` (Model Registry)
| id | asset_id | version_tag | model_type | hyperparameters (JSONB) | is_active |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `m-333` | `...0000` | v1.0-LSTM-BTC | LSTM | `{"layers": 3, "units": 64, "lr": 0.001}` | true |

#### `predictions` (From ML Engine)
| time (Target) | asset_id | model_id | predicted_value | confidence_interval_high |
| :--- | :--- | :--- | :--- | :--- |
| `2025-05-10 14:00:00` | `...0000` | `m-333` | 66100.00 | 66450.00 |

#### `backtest_results` (Strategy Proof)
| id | user_id | model_id | strategy_name | total_return | trades_log (JSONB) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `b-444` | `a1b2...` | `m-333` | MeanReversionV1 | 12.4% | `[{"type": "BUY", "price": 62000}, {"type": "SELL", "price": 65000}]` |

---

### 5. Application & Interaction Pillar

#### `chat_history` (Conversation & Dynamic Charts)
| id | user_id | role | content | ui_payload (JSONB) |
| :--- | :--- | :--- | :--- | :--- |
| `ch-555` | `a1b2...` | assistant | Here is the comparison of BTC and ETH RSI levels for the last hour. | `{"type": "chart", "chart_type": "side_by_side", "data": [{"symbol": "BTC", "rsi": 32}, {"symbol": "ETH", "rsi": 45}]}` |

#### `watchlists`
| user_id | asset_id |
| :--- | :--- |
| `a1b2...` | `...0000` (BTC) |
| `a1b2...` | `...1111` (ETH) |

#### `scraper_logs` (Health Monitor)
| source | status | rows_affected | executed_at | error_msg |
| :--- | :--- | :--- | :--- | :--- |
| Binance_Scraper | SUCCESS | 60 | `2025-05-10 11:00:01` | NULL |
| Twitter_Scraper | ERROR | 0 | `2025-05-10 11:05:00` | "Rate limit exceeded (429)" |

---

### Key Takeaway for the Development Team:
1.  **The Scrapers:** Populate `market_data`, `on_chain_metrics`, `knowledge_base`, and `scraper_logs`.
2.  **The Analyst (Cron Job):** Reads the above tables and populates `curated_news`.
3.  **The ML Engine:** Reads `market_data` $\rightarrow$ Trains and updates `ml_models` $\rightarrow$ Generates `predictions`.
4.  **The Chatbot (FastAPI):** Reads all tables and writes to `chat_history`.
5.  **The Frontend:** Pulls `chat_history` and renders the JSON in `ui_payload` as interactive charts.