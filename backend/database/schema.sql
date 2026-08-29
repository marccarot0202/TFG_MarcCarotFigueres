-- Tabla de contratos analizados (cache local)
CREATE TABLE IF NOT EXISTS contracts (
  address TEXT PRIMARY KEY COLLATE NOCASE,
  name TEXT,
  verified INTEGER DEFAULT 0,
  source_code TEXT,
  abi TEXT,
  risk_level TEXT,
  risk_score INTEGER DEFAULT 0,
  issues TEXT,
  ai_summary TEXT,
  first_seen INTEGER DEFAULT (unixepoch()),
  last_analyzed INTEGER DEFAULT (unixepoch()),
  analysis_count INTEGER DEFAULT 1
);

-- Tabla de transacciones históricas
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT,
  from_address TEXT COLLATE NOCASE,
  to_address TEXT COLLATE NOCASE,
  value TEXT,
  data TEXT,
  function_selector TEXT,
  chain_id TEXT,
  origin TEXT,
  risk_level TEXT,
  risk_score INTEGER,
  user_decision TEXT DEFAULT 'pending',
  timestamp INTEGER DEFAULT (unixepoch())
);

-- Tabla de direcciones conocidas (blacklist/whitelist/datasets públicos)
CREATE TABLE IF NOT EXISTS known_addresses (
  address TEXT PRIMARY KEY COLLATE NOCASE,
  label TEXT,
  type TEXT,
  source TEXT,
  added INTEGER DEFAULT (unixepoch())
);

-- Tabla de patrones de fraude detectados
CREATE TABLE IF NOT EXISTS fraud_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_type TEXT,
  signature TEXT,
  description TEXT,
  occurrences INTEGER DEFAULT 1,
  last_seen INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS analysis_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER DEFAULT (unixepoch()),
  chain_id TEXT,
  from_address TEXT,
  to_address TEXT,
  method_selector TEXT,
  decoded_method TEXT,
  risk_level TEXT,
  risk_score INTEGER,
  recommended_action TEXT,
  origin TEXT,
  raw_tx_json TEXT,
  normalized_tx_json TEXT,
  decoded_json TEXT,
  findings_json TEXT,
  explanation TEXT,
  context_summary TEXT,
  deterministic_verdict_json TEXT,
  local_memory_signals_json TEXT,
  known_address_signals_json TEXT,
  ai_review_json TEXT,
  final_verdict_json TEXT,
  semantic_facts_json TEXT,
  performance_json TEXT,
  evaluation_json TEXT
);

CREATE TABLE IF NOT EXISTS address_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  chain_id TEXT,
  label TEXT,
  notes TEXT,
  first_seen_at INTEGER DEFAULT (unixepoch()),
  last_seen_at INTEGER DEFAULT (unixepoch()),
  times_seen INTEGER DEFAULT 1,
  last_method_selector TEXT,
  UNIQUE(address, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_analysis_history_to_address
ON analysis_history(to_address);

CREATE INDEX IF NOT EXISTS idx_analysis_history_method_selector
ON analysis_history(method_selector);

CREATE INDEX IF NOT EXISTS idx_address_cache_address_chain
ON address_cache(address, chain_id);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_contracts_risk ON contracts(risk_level);
CREATE INDEX IF NOT EXISTS idx_contracts_verified ON contracts(verified);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_known_addresses_type ON known_addresses(type);
CREATE INDEX IF NOT EXISTS idx_fraud_signature ON fraud_patterns(signature);
