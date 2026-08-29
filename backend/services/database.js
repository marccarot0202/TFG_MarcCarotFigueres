const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.WEB3_SECURITY_DB_PATH ||
  path.join(__dirname, '../database/web3_security.db');
let db = null;

const ANALYSIS_HISTORY_EXTRA_COLUMNS = {
  context_summary: 'TEXT',
  deterministic_verdict_json: 'TEXT',
  local_memory_signals_json: 'TEXT',
  known_address_signals_json: 'TEXT',
  ai_review_json: 'TEXT',
  final_verdict_json: 'TEXT',
  semantic_facts_json: 'TEXT',
  performance_json: 'TEXT',
  evaluation_json: 'TEXT',
};

function ensureAnalysisHistoryColumns() {
  return new Promise((resolve, reject) => {
    db.all('PRAGMA table_info(analysis_history)', [], (pragmaError, rows) => {
      if (pragmaError) {
        reject(pragmaError);
        return;
      }

      const existingColumns = new Set((rows || []).map((row) => row.name));
      const missingColumns = Object.entries(ANALYSIS_HISTORY_EXTRA_COLUMNS)
        .filter(([name]) => !existingColumns.has(name));

      const addNextColumn = (index) => {
        if (index >= missingColumns.length) {
          resolve();
          return;
        }

        const [name, type] = missingColumns[index];
        db.run(
          `ALTER TABLE analysis_history ADD COLUMN ${name} ${type}`,
          [],
          (alterError) => {
            if (alterError) {
              reject(alterError);
              return;
            }

            addNextColumn(index + 1);
          },
        );
      };

      addNextColumn(0);
    });
  });
}

/**
 * Inicializar base de datos
 */
function initDB() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Error obrint la base de dades:', err.message);
        reject(err);
        return;
      }

      console.log('✅ Base de dades connectada');

      const schemaPath = path.join(__dirname, '../database/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');

      db.exec(schema, (err) => {
        if (err) {
          console.error('❌ Error creant les taules:', err.message);
          reject(err);
        } else {
          console.log('✅ Taules inicialitzades');
          ensureAnalysisHistoryColumns().then(resolve).catch(reject);
        }
      });
    });
  });
}

/**
 * Lookup rápido de dirección conocida (blacklist/whitelist)
 */
function lookupAddress(address) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM known_addresses WHERE address = ? COLLATE NOCASE';
    db.get(sql, [address.toLowerCase()], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

/**
 * Lookup de contrato en cache
 */
function getContractCache(address) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM contracts WHERE address = ? COLLATE NOCASE';
    db.get(sql, [address.toLowerCase()], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

/**
 * Guardar análisis de contrato en cache
 */
function saveContractAnalysis(address, analysis) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO contracts (
        address, name, verified, source_code, abi, risk_level, risk_score, issues, ai_summary, last_analyzed
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(address) DO UPDATE SET
        name = excluded.name,
        verified = excluded.verified,
        source_code = excluded.source_code,
        abi = excluded.abi,
        risk_level = excluded.risk_level,
        risk_score = excluded.risk_score,
        issues = excluded.issues,
        ai_summary = excluded.ai_summary,
        last_analyzed = unixepoch(),
        analysis_count = analysis_count + 1
    `;

    db.run(
      sql,
      [
        address.toLowerCase(),
        analysis.name || null,
        analysis.verified ? 1 : 0,
        analysis.source_code || null,
        analysis.abi || null,
        analysis.risk_level,
        analysis.risk_score,
        JSON.stringify(analysis.issues || []),
        analysis.ai_summary || null,
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      },
    );
  });
}

/**
 * Guardar transacción analizada (tabla antigua/minimal)
 */
function saveTransaction(txData, analysis) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO transactions 
      (from_address, to_address, value, data, function_selector, chain_id, origin, risk_level, risk_score, user_decision)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const functionSelector =
      txData.data && txData.data.length >= 10 ? txData.data.substring(0, 10) : null;

    db.run(
      sql,
      [
        txData.from?.toLowerCase(),
        txData.to?.toLowerCase(),
        txData.value,
        txData.data,
        functionSelector,
        txData.chainId,
        txData.origin,
        analysis.risk_level,
        analysis.risk_score,
        'pending',
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      },
    );
  });
}

/**
 * Guardar análisis completo en histórico
 */
function saveAnalysisHistory(rawTx, analysis) {
  return new Promise((resolve, reject) => {
    const normalizedTx = analysis.normalized_tx || null;
    const decoded = analysis.decoded || null;
    const findings = analysis.findings || analysis.issues || [];

    const sql = `
      INSERT INTO analysis_history (
        chain_id,
        from_address,
        to_address,
        method_selector,
        decoded_method,
        risk_level,
        risk_score,
        recommended_action,
        origin,
        raw_tx_json,
        normalized_tx_json,
        decoded_json,
        findings_json,
        explanation,
        context_summary,
        deterministic_verdict_json,
        local_memory_signals_json,
        known_address_signals_json,
        ai_review_json,
        final_verdict_json,
        semantic_facts_json,
        performance_json,
        evaluation_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      sql,
      [
        rawTx.chainId || normalizedTx?.chainId || null,
        rawTx.from?.toLowerCase?.() || normalizedTx?.from || null,
        rawTx.to?.toLowerCase?.() || normalizedTx?.to || null,
        normalizedTx?.method_selector || null,
        decoded?.method || null,
        analysis.risk_level || null,
        analysis.risk_score || null,
        analysis.recommended_action || null,
        rawTx.origin || normalizedTx?.origin || null,
        JSON.stringify(rawTx || {}),
        JSON.stringify(normalizedTx || {}),
        JSON.stringify(decoded || null),
        JSON.stringify(findings || []),
        analysis.explanation || null,
        analysis.context_summary || null,
        JSON.stringify(analysis.deterministic_verdict || null),
        JSON.stringify(analysis.local_memory_signals || null),
        JSON.stringify(analysis.known_address_signals || null),
        JSON.stringify(analysis.ai_review || null),
        JSON.stringify(analysis.final_verdict || null),
        JSON.stringify(analysis.semantic_facts || null),
        JSON.stringify(analysis.performance || null),
        JSON.stringify(analysis.evaluation || null),
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      },
    );
  });
}

function updateAnalysisPerformance(id, performance) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE analysis_history SET performance_json = ? WHERE id = ?',
      [JSON.stringify(performance || null), id],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      },
    );
  });
}

/**
 * Obtener dirección desde cache local
 */
function getAddressCache(address, chainId = null) {
  return new Promise((resolve, reject) => {
    if (!address) {
      resolve(null);
      return;
    }

    let sql = `
      SELECT * FROM address_cache
      WHERE address = ? COLLATE NOCASE
    `;
    const params = [address.toLowerCase()];

    if (chainId) {
      sql += ` AND chain_id = ?`;
      params.push(chainId);
    } else {
      sql += ` AND chain_id IS NULL`;
    }

    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

/**
 * Insertar o actualizar cache de direcciones vistas
 */
function upsertAddressCache({
  address,
  chainId = null,
  label = null,
  notes = null,
  lastMethodSelector = null,
}) {
  return new Promise((resolve, reject) => {
    if (!address) {
      resolve(null);
      return;
    }

    const sql = `
      INSERT INTO address_cache (
        address,
        chain_id,
        label,
        notes,
        first_seen_at,
        last_seen_at,
        times_seen,
        last_method_selector
      )
      VALUES (?, ?, ?, ?, unixepoch(), unixepoch(), 1, ?)
      ON CONFLICT(address, chain_id) DO UPDATE SET
        label = COALESCE(excluded.label, address_cache.label),
        notes = COALESCE(excluded.notes, address_cache.notes),
        last_seen_at = unixepoch(),
        times_seen = address_cache.times_seen + 1,
        last_method_selector = COALESCE(excluded.last_method_selector, address_cache.last_method_selector)
    `;

    db.run(
      sql,
      [
        address.toLowerCase(),
        chainId,
        label,
        notes,
        lastMethodSelector,
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      },
    );
  });
}

/**
 * Buscar patrones similares en historial antiguo
 */
function findSimilarTransactions(toAddress, functionSelector, limit = 10) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT risk_level, risk_score, user_decision, COUNT(*) as count
      FROM transactions
      WHERE to_address = ? COLLATE NOCASE
      AND function_selector = ?
      AND timestamp > unixepoch() - (30 * 24 * 3600)
      GROUP BY risk_level, user_decision
      ORDER BY count DESC
      LIMIT ?
    `;

    db.all(sql, [toAddress?.toLowerCase(), functionSelector, limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

/**
 * Buscar análisis recientes similares en el histórico nuevo
 */
function findRecentAnalysisByTarget(toAddress, methodSelector, limit = 10) {
  return new Promise((resolve, reject) => {
    if (!toAddress) {
      resolve([]);
      return;
    }

    let sql = `
      SELECT risk_level, risk_score, recommended_action, COUNT(*) as count
      FROM analysis_history
      WHERE to_address = ? COLLATE NOCASE
    `;
    const params = [toAddress.toLowerCase()];

    if (methodSelector) {
      sql += ` AND method_selector = ?`;
      params.push(methodSelector);
    }

    sql += `
      AND created_at > unixepoch() - (30 * 24 * 3600)
      GROUP BY risk_level, risk_score, recommended_action
      ORDER BY count DESC
      LIMIT ?
    `;
    params.push(limit);

    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

/**
 * Añadir dirección conocida (dataset import)
 */
function addKnownAddress(address, label, type, source) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO known_addresses (address, label, type, source)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET
        label = excluded.label,
        type = excluded.type,
        source = excluded.source
    `;

    db.run(sql, [address.toLowerCase(), label, type, source], function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

/**
 * Obtener estadísticas generales
 */
function getStats() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM transactions) as total_transactions,
        (SELECT COUNT(*) FROM contracts) as total_contracts,
        (SELECT COUNT(*) FROM known_addresses WHERE type = 'scam') as known_scams,
        (SELECT COUNT(*) FROM transactions WHERE risk_level = 'ALTO') as high_risk_txs,
        (SELECT COUNT(*) FROM analysis_history) as total_analysis_history,
        (SELECT COUNT(*) FROM address_cache) as total_cached_addresses
    `;

    db.get(sql, [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/**
 * Cerrar conexión (cleanup)
 */
function closeDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

function getDashboardStats() {
  return new Promise((resolve, reject) => {
    const stats = {
      total_analysis: 0,
      low_risk: 0,
      medium_risk: 0,
      high_risk: 0,
      known_addresses: 0,
      cached_addresses: 0,
    };

    const queries = [
      {
        key: 'total_analysis',
        sql: 'SELECT COUNT(*) AS count FROM analysis_history',
      },
      {
        key: 'low_risk',
        sql: "SELECT COUNT(*) AS count FROM analysis_history WHERE risk_level = 'BAJO'",
      },
      {
        key: 'medium_risk',
        sql: "SELECT COUNT(*) AS count FROM analysis_history WHERE risk_level = 'MEDIO'",
      },
      {
        key: 'high_risk',
        sql: "SELECT COUNT(*) AS count FROM analysis_history WHERE risk_level = 'ALTO'",
      },
      {
        key: 'known_addresses',
        sql: 'SELECT COUNT(*) AS count FROM known_addresses',
      },
      {
        key: 'cached_addresses',
        sql: 'SELECT COUNT(*) AS count FROM address_cache',
      },
    ];

    let pending = queries.length;

    queries.forEach((query) => {
      db.get(query.sql, [], (err, row) => {
        if (err) {
          console.warn(`⚠️ No s'ha pogut calcular ${query.key}:`, err.message);
          stats[query.key] = 0;
        } else {
          stats[query.key] = row?.count || 0;
        }

        pending -= 1;

        if (pending === 0) {
          resolve(stats);
        }
      });
    });
  });
}

function getRecentAnalysisHistory(limit = 10) {
  return new Promise((resolve, reject) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

    const sql = `
      SELECT rowid AS id, *
      FROM analysis_history
      ORDER BY rowid DESC
      LIMIT ?
    `;

    db.all(sql, [safeLimit], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows || []);
    });
  });
}

function getKnownAddresses({ limit = 50, type = null, search = null } = {}) {
  return new Promise((resolve, reject) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

    const conditions = [];
    const params = [];

    if (type && type !== 'all') {
      conditions.push('LOWER(type) = LOWER(?)');
      params.push(type);
    }

    if (search) {
      conditions.push(
        '(LOWER(address) LIKE LOWER(?) OR LOWER(label) LIKE LOWER(?) OR LOWER(source) LIKE LOWER(?))',
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        rowid AS id,
        address,
        label,
        type,
        source,
        added
      FROM known_addresses
      ${whereClause}
      ORDER BY added DESC
      LIMIT ?
    `;

    params.push(safeLimit);

    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows || []);
    });
  });
}

function getDashboardMetrics() {
  return new Promise((resolve, reject) => {
    const metrics = {
      risk_distribution: [],
      method_distribution: [],
    };

    const riskSql = `
      SELECT risk_level AS label, COUNT(*) AS count
      FROM analysis_history
      GROUP BY risk_level
      ORDER BY count DESC
    `;

    const methodSql = `
      SELECT
        COALESCE(decoded_method, method_selector, 'desconegut') AS label,
        COUNT(*) AS count
      FROM analysis_history
      GROUP BY COALESCE(decoded_method, method_selector, 'desconegut')
      ORDER BY count DESC
      LIMIT 8
    `;

    db.all(riskSql, [], (riskErr, riskRows) => {
      if (riskErr) {
        reject(riskErr);
        return;
      }

      metrics.risk_distribution = riskRows || [];

      db.all(methodSql, [], (methodErr, methodRows) => {
        if (methodErr) {
          reject(methodErr);
          return;
        }

        metrics.method_distribution = methodRows || [];

        resolve(metrics);
      });
    });
  });
}

function safeJsonParse(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function getAnalysisHistoryDetail(id) {
  return new Promise((resolve, reject) => {
    const safeId = Number(id);

    if (!Number.isInteger(safeId) || safeId <= 0) {
      reject(new Error("L'identificador de l'anàlisi no és vàlid"));
      return;
    }

    const sql = `
      SELECT rowid AS id, *
      FROM analysis_history
      WHERE rowid = ?
      LIMIT 1
    `;

    db.get(sql, [safeId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      if (!row) {
        resolve(null);
        return;
      }

      const detail = {
        ...row,

        final_verdict:
          safeJsonParse(row.final_verdict_json, null) ||
          safeJsonParse(row.final_verdict, null) ||
          {
            risk_level: row.risk_level,
            risk_score: row.risk_score,
            recommended_action: row.recommended_action,
          },

        findings:
          safeJsonParse(row.findings_json, null) ||
          safeJsonParse(row.findings, null) ||
          [],

        decoded:
          safeJsonParse(row.decoded_json, null) ||
          safeJsonParse(row.decoded, null) ||
          {
            method: row.decoded_method,
            selector: row.method_selector,
          },

        ai_review:
          safeJsonParse(row.ai_review_json, null) ||
          safeJsonParse(row.ai_review, null) ||
          null,

        known_address_signals:
          safeJsonParse(row.known_address_signals_json, null) ||
          safeJsonParse(row.known_address_signals, null) ||
          [],

        normalized_tx:
          safeJsonParse(row.normalized_tx_json, null) ||
          safeJsonParse(row.normalized_tx, null) ||
          {
            chainId: row.chain_id,
            from: row.from_address,
            to: row.to_address,
            origin: row.origin,
          },

        deterministic_verdict:
          safeJsonParse(row.deterministic_verdict_json, null) || null,

        local_memory_signals:
          safeJsonParse(row.local_memory_signals_json, null) || null,

        semantic_facts:
          safeJsonParse(row.semantic_facts_json, null) || null,

        performance:
          safeJsonParse(row.performance_json, null) || null,

        evaluation:
          safeJsonParse(row.evaluation_json, null) || null,
      };

      resolve(detail);
    });
  });
}

module.exports = {
  initDB,
  lookupAddress,
  getContractCache,
  saveContractAnalysis,
  saveTransaction,
  saveAnalysisHistory,
  updateAnalysisPerformance,
  getAddressCache,
  upsertAddressCache,
  findSimilarTransactions,
  findRecentAnalysisByTarget,
  addKnownAddress,
  getStats,
  closeDB,
  getDashboardStats,
  getRecentAnalysisHistory,
  getKnownAddresses,
  getDashboardMetrics,
  getAnalysisHistoryDetail,
};
