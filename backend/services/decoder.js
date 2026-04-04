const MAX_UINT256 = (1n << 256n) - 1n;

const KNOWN_SELECTORS = {
  APPROVE: '0x095ea7b3',
  SET_APPROVAL_FOR_ALL: '0xa22cb465',
};

function strip0x(value = '') {
  return typeof value === 'string' && value.startsWith('0x') ? value.slice(2) : value;
}

function splitAbiWords(data = '0x') {
  const raw = strip0x(data || '');

  if (raw.length < 8) {
    return [];
  }

  const paramsHex = raw.slice(8);

  if (paramsHex.length === 0) {
    return [];
  }

  if (paramsHex.length % 64 !== 0) {
    return [];
  }

  const words = [];

  for (let i = 0; i < paramsHex.length; i += 64) {
    words.push(paramsHex.slice(i, i + 64));
  }

  return words;
}

function wordToAddress(word) {
  if (!word || word.length !== 64) {
    return null;
  }

  return `0x${word.slice(24)}`.toLowerCase();
}

function wordToBigInt(word) {
  if (!word || word.length !== 64) {
    return null;
  }

  return BigInt(`0x${word}`);
}

function wordToBool(word) {
  if (!word || word.length !== 64) {
    return null;
  }

  return BigInt(`0x${word}`) !== 0n;
}

function decodeApprove(data) {
  const words = splitAbiWords(data);

  if (words.length < 2) {
    return null;
  }

  const spender = wordToAddress(words[0]);
  const amountBigInt = wordToBigInt(words[1]);

  if (!spender || amountBigInt === null) {
    return null;
  }

  return {
    method: 'approve',
    signature: 'approve(address,uint256)',
    selector: KNOWN_SELECTORS.APPROVE,
    spender,
    amount: amountBigInt.toString(),
    amount_hex: `0x${words[1]}`,
    is_infinite_approval: amountBigInt === MAX_UINT256,
  };
}

function decodeSetApprovalForAll(data) {
  const words = splitAbiWords(data);

  if (words.length < 2) {
    return null;
  }

  const operator = wordToAddress(words[0]);
  const approved = wordToBool(words[1]);

  if (!operator || approved === null) {
    return null;
  }

  return {
    method: 'setApprovalForAll',
    signature: 'setApprovalForAll(address,bool)',
    selector: KNOWN_SELECTORS.SET_APPROVAL_FOR_ALL,
    operator,
    approved,
  };
}

function decodeKnownTransaction(tx) {
  if (!tx || !tx.method_selector || !tx.data) {
    return null;
  }

  switch (tx.method_selector) {
    case KNOWN_SELECTORS.APPROVE:
      return decodeApprove(tx.data);

    case KNOWN_SELECTORS.SET_APPROVAL_FOR_ALL:
      return decodeSetApprovalForAll(tx.data);

    default:
      return null;
  }
}

module.exports = {
  KNOWN_SELECTORS,
  decodeKnownTransaction,
};