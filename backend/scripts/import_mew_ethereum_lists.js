const { initDB, addKnownAddress, closeDB } = require('../services/database');

const DARKLIST_URL =
  'https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/addresses/addresses-darklist.json';

const LIGHTLIST_URL =
  'https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/addresses/addresses-lightlist.json';

function normalizeAddress(address) {
  if (!address || typeof address !== 'string') {
    return null;
  }

  return address.trim().toLowerCase();
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url} (${response.status})`);
  }

  return await response.json();
}

function mapDarklistEntry(entry) {
  const address = normalizeAddress(entry.address);

  if (!address) {
    return null;
  }

  return {
    address,
    label: entry.comment
      ? `MEW darklist: ${entry.comment}`.slice(0, 255)
      : 'MEW darklist address',
    type: 'warning',
    source: 'mew_ethereum_lists_darklist',
  };
}

function mapLightlistEntry(entry) {
  const address = normalizeAddress(entry.address);

  if (!address) {
    return null;
  }

  return {
    address,
    label: entry.comment
      ? `MEW lightlist: ${entry.comment}`.slice(0, 255)
      : 'MEW lightlist address',
    type: 'trusted',
    source: 'mew_ethereum_lists_lightlist',
  };
}

async function importEntries(entries, mapper) {
  let imported = 0;
  let skipped = 0;

  for (const entry of entries) {
    const mapped = mapper(entry);

    if (!mapped) {
      skipped += 1;
      continue;
    }

    await addKnownAddress(
      mapped.address,
      mapped.label,
      mapped.type,
      mapped.source,
    );

    imported += 1;
  }

  return { imported, skipped };
}

async function main() {
  await initDB();

  console.log('🌐 Descargando darklist de MEW...');
  const darklist = await fetchJson(DARKLIST_URL);

  console.log('🌐 Descargando lightlist de MEW...');
  const lightlist = await fetchJson(LIGHTLIST_URL);

  console.log(`📦 Darklist descargada: ${Array.isArray(darklist) ? darklist.length : 0} entradas`);
  console.log(`📦 Lightlist descargada: ${Array.isArray(lightlist) ? lightlist.length : 0} entradas`);

  const darkResult = await importEntries(
    Array.isArray(darklist) ? darklist : [],
    mapDarklistEntry,
  );

  const lightResult = await importEntries(
    Array.isArray(lightlist) ? lightlist : [],
    mapLightlistEntry,
  );

  console.log('✅ Importación completada');
  console.log(`   Darklist -> importadas: ${darkResult.imported}, omitidas: ${darkResult.skipped}`);
  console.log(`   Lightlist -> importadas: ${lightResult.imported}, omitidas: ${lightResult.skipped}`);
}

main()
  .catch(async (error) => {
    console.error('❌ Error importando ethereum-lists:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeDB();
    } catch (_) {
    }
  });