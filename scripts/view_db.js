const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

function resolveDbPath() {
  const argPath = process.argv[2] && !['overview', 'tables', 'schema', 'table', 'search', 'help'].includes(process.argv[2])
    ? process.argv[2]
    : null;

  const candidates = [
    argPath,
    process.env.DB_PATH,
    path.join(__dirname, '../database/web3_security.db'),
    path.join(__dirname, './database/web3_security.db'),
    path.join(process.cwd(), 'database/web3_security.db'),
    path.join(process.cwd(), 'backend/database/web3_security.db'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const full = path.resolve(candidate);
    if (fs.existsSync(full)) return full;
  }

  return path.resolve(candidates[0] || path.join(__dirname, '../database/web3_security.db'));
}

function getCommandIndex() {
  if (process.argv[2] && !process.argv[2].endsWith('.db') && !process.argv[2].includes('web3_security.db')) {
    return 2;
  }
  return 3;
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });
}

function printRow(row) {
  console.log('-'.repeat(90));
  for (const [key, value] of Object.entries(row)) {
    let rendered = value;
    if (typeof rendered === 'string' && rendered.length > 300) {
      rendered = rendered.slice(0, 300) + '...';
    }
    console.log(`${key}: ${rendered}`);
  }
}

async function tableExists(db, name) {
  const row = await get(db, "SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [name]);
  return !!row;
}

async function printOverview(db) {
  const tables = await all(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('\nTABLAS ENCONTRADAS');
  console.log('='.repeat(90));
  for (const t of tables) {
    const countRow = await get(db, `SELECT COUNT(*) as total FROM ${t.name}`);
    console.log(`${t.name}: ${countRow.total} filas`);
  }

  const previewTables = ['known_addresses', 'address_cache', 'analysis_history', 'transactions', 'contracts'];
  for (const table of previewTables) {
    if (!(await tableExists(db, table))) continue;
    console.log(`\nPREVIEW: ${table}`);
    console.log('='.repeat(90));
    const rows = await all(db, `SELECT * FROM ${table} ORDER BY rowid DESC LIMIT 5`);
    if (rows.length === 0) {
      console.log('(sin filas)');
      continue;
    }
    rows.forEach(printRow);
  }
}

async function printTables(db) {
  const tables = await all(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('\nTABLAS');
  console.log('='.repeat(90));
  tables.forEach((t) => console.log(t.name));
}

async function printSchema(db, tableName) {
  const tables = tableName
    ? [{ name: tableName }]
    : await all(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");

  for (const table of tables) {
    if (!(await tableExists(db, table.name))) {
      console.log(`No existe la tabla: ${table.name}`);
      continue;
    }
    console.log(`\nSCHEMA: ${table.name}`);
    console.log('='.repeat(90));
    const rows = await all(db, `PRAGMA table_info(${table.name})`);
    rows.forEach((r) => console.log(`${r.name} | ${r.type} | pk=${r.pk} | notnull=${r.notnull} | default=${r.dflt_value}`));
  }
}

async function printTable(db, tableName, limitArg) {
  if (!tableName) throw new Error('Falta nombre de tabla. Ejemplo: table known_addresses 20');
  if (!(await tableExists(db, tableName))) throw new Error(`No existe la tabla: ${tableName}`);
  const limit = Number(limitArg || 20);
  const rows = await all(db, `SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT ?`, [limit]);
  console.log(`\nTABLA: ${tableName} | filas mostradas: ${rows.length}`);
  console.log('='.repeat(90));
  rows.forEach(printRow);
}

async function searchAddress(db, address) {
  if (!address) throw new Error('Falta address. Ejemplo: search 0xabc...');
  const normalized = address.toLowerCase();
  const candidates = [
    { table: 'known_addresses', columns: ['address'] },
    { table: 'address_cache', columns: ['address'] },
    { table: 'analysis_history', columns: ['from_address', 'to_address'] },
    { table: 'transactions', columns: ['from_address', 'to_address'] },
  ];

  for (const candidate of candidates) {
    if (!(await tableExists(db, candidate.table))) continue;
    console.log(`\nBUSQUEDA EN ${candidate.table}`);
    console.log('='.repeat(90));
    const where = candidate.columns.map((c) => `${c} = ? COLLATE NOCASE`).join(' OR ');
    const params = candidate.columns.map(() => normalized);
    const rows = await all(db, `SELECT * FROM ${candidate.table} WHERE ${where} ORDER BY rowid DESC LIMIT 10`, params);
    if (rows.length === 0) console.log('(sin coincidencias)');
    rows.forEach(printRow);
  }
}

function printHelp() {
  console.log(`\nUso:\n  node view_db.js                         Vista general\n  node view_db.js tables                  Lista tablas\n  node view_db.js schema                  Schema completo\n  node view_db.js schema known_addresses  Schema de una tabla\n  node view_db.js table known_addresses 20\n  node view_db.js search 0x0059...\n\nOpcional:\n  node view_db.js C:\\ruta\\web3_security.db overview\n  set DB_PATH=C:\\ruta\\web3_security.db\n`);
}

async function main() {
  const dbPath = resolveDbPath();
  const commandIndex = getCommandIndex();
  const command = process.argv[commandIndex] || 'overview';
  const args = process.argv.slice(commandIndex + 1);

  console.log(`BD: ${dbPath}`);
  if (!fs.existsSync(dbPath)) {
    throw new Error('No se ha encontrado la base de datos. Ejecuta este script desde backend/scripts o define DB_PATH.');
  }

  const db = new sqlite3.Database(dbPath);
  try {
    if (command === 'help') printHelp();
    else if (command === 'overview') await printOverview(db);
    else if (command === 'tables') await printTables(db);
    else if (command === 'schema') await printSchema(db, args[0]);
    else if (command === 'table') await printTable(db, args[0], args[1]);
    else if (command === 'search') await searchAddress(db, args[0]);
    else {
      console.log(`Comando desconocido: ${command}`);
      printHelp();
    }
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
