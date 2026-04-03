function detectType(selector) {
  if (!selector) return 'eth_transfer';
  if (selector === '0x095ea7b3') return 'approve';
  if (selector === '0xa22cb465') return 'setApprovalForAll';
  return 'contract_interaction';
}

function isInfiniteApprove(tx) {
  if (tx.function_selector !== '0x095ea7b3') return false;
  if (!tx.data || tx.data.length < 138) return false;

  const amountHex = tx.data.slice(-64).toLowerCase();
  return /^f{64}$/.test(amountHex);
}

function normalizeTx(txData) {
  const data = txData.data || '0x';
  const functionSelector = data && data.length >= 10 ? data.substring(0, 10) : null;

  const normalized = {
    tx_hash: txData.tx_hash || null,
    from: txData.from || null,
    to: txData.to || null,
    value: txData.value || '0',
    data,
    chainId: txData.chainId || '11155111',
    origin: txData.origin || 'unknown',
    function_selector: functionSelector,
    type: txData.type || detectType(functionSelector),
  };

  normalized.is_infinite_approve = isInfiniteApprove(normalized);

  return normalized;
}

module.exports = { normalizeTx };