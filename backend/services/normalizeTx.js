function ensureHex(value, fallback = '0x') {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  const trimmed = value.trim().toLowerCase();

  if (trimmed.startsWith('0x')) {
    return trimmed;
  }

  return `0x${trimmed}`;
}

function normalizeAddress(address) {
  if (typeof address !== 'string' || address.trim() === '') {
    return null;
  }

  return address.trim().toLowerCase();
}

function getMethodSelector(data) {
  const normalizedData = ensureHex(data, '0x');

  if (normalizedData === '0x' || normalizedData.length < 10) {
    return null;
  }

  return normalizedData.slice(0, 10);
}

function hasNonZeroValue(value) {
  if (!value || value === '0x' || value === '0x0' || value === '0') {
    return false;
  }

  return true;
}

function isContractInteraction(data) {
  const normalizedData = ensureHex(data, '0x');
  return normalizedData !== '0x' && normalizedData.length >= 10;
}

function normalizeTx(rawTx = {}) {
  const data = ensureHex(rawTx.data, '0x');
  const value = typeof rawTx.value === 'string' ? rawTx.value.toLowerCase() : '0x0';
  const methodSelector = getMethodSelector(data);

  return {
    type: rawTx.type || 'transaction',
    chainId: rawTx.chainId || null,
    from: normalizeAddress(rawTx.from),
    to: normalizeAddress(rawTx.to),
    value,
    data,
    origin: rawTx.origin || 'unknown',
    method_selector: methodSelector,
    has_value: hasNonZeroValue(value),
    is_contract_interaction: isContractInteraction(data),
    decoded: null,
  };
}

module.exports = {
  normalizeTx,
  getMethodSelector,
};