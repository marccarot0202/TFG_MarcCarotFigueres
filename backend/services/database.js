const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../database/web3_security.db');
let db = null;

/**
 * Inicializar base de datos
 */
function initDB() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Error abriendo BD:', err.message);
        reject(err);
        return;
      }
      
      console.log('✅ Base de datos conectada');
      
      // Leer y ejecutar schema.sql
      const schemaPath = path.join(__dirname, '../database/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      db.exec(schema, (err) => {
        if (err) {
          console.error('❌ Error creando tablas:', err.message);
          reject(err);
        } else {
          console.log('✅ Tablas inicializadas');
          resolve();
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
 * Guardar transacción analizada
 */
function saveTransaction(txData, analysis) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO transactions 
      (from_address, to_address, value, data, function_selector, chain_id, origin, risk_level, risk_score, user_decision)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const functionSelector = txData.data && txData.data.length >= 10 
      ? txData.data.substring(0, 10) 
      : null;
    
    db.run(sql, [
      txData.from?.toLowerCase(),
      txData.to?.toLowerCase(),
      txData.value,
      txData.data,
      functionSelector,
      txData.chainId,
      txData.origin,
      analysis.risk_level,
      analysis.risk_score,
      'pending'
    ], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

/**
 * Buscar patrones similares en historial
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
    
    db.run(sql, [address.toLowerCase(), label, type, source], function(err) {
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
        (SELECT COUNT(*) FROM transactions WHERE risk_level = 'ALTO') as high_risk_txs
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

module.exports = {
  initDB,
  lookupAddress,
  getContractCache,
  saveContractAnalysis,
  saveTransaction,
  findSimilarTransactions,
  addKnownAddress,
  getStats,
  closeDB
};