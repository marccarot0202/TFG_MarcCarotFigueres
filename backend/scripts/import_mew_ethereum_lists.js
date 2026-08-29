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
    throw new Error(`No s'ha pogut descarregar ${url} (${response.status})`);
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
      ? `Llista fosca de MEW: ${entry.comment}`.slice(0, 255)
      : 'Adreça de la llista fosca de MEW',
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
      ? `Llista de confiança de MEW: ${entry.comment}`.slice(0, 255)
      : 'Adreça de la llista de confiança de MEW',
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

  console.log('🌐 Descarregant la llista fosca de MEW...');
  const darklist = await fetchJson(DARKLIST_URL);

  console.log('🌐 Descarregant la llista de confiança de MEW...');
  const lightlist = await fetchJson(LIGHTLIST_URL);

  console.log(
    `📦 Llista fosca descarregada: ${
      Array.isArray(darklist) ? darklist.length : 0
    } entrades`,
  );
  console.log(
    `📦 Llista de confiança descarregada: ${
      Array.isArray(lightlist) ? lightlist.length : 0
    } entrades`,
  );

  const darkResult = await importEntries(
    Array.isArray(darklist) ? darklist : [],
    mapDarklistEntry,
  );

  const lightResult = await importEntries(
    Array.isArray(lightlist) ? lightlist : [],
    mapLightlistEntry,
  );

  console.log('✅ Importació completada');
  console.log(
    `   Llista fosca -> importades: ${darkResult.imported}, omeses: ${darkResult.skipped}`,
  );
  console.log(
    `   Llista de confiança -> importades: ${lightResult.imported}, omeses: ${lightResult.skipped}`,
  );
}

main()
  .catch(async (error) => {
    console.error('❌ Error important ethereum-lists:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeDB();
    } catch (_) {}
  });
