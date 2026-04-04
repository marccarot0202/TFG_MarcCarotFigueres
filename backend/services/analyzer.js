const { askOllama } = require('./ollama');
const { normalizeTx } = require('./normalizeTx');
const { decodeKnownTransaction } = require('./decoder');

function normalizeRisk(risk) {
  const text = String(risk || '').toUpperCase();

  if (text.includes('ALTO')) return 'ALTO';
  if (text.includes('MEDIO')) return 'MEDIO';
  if (text.includes('BAJO')) return 'BAJO';

  return 'DESCONOCIDO';
}

function riskToScore(riskLevel) {
  switch (riskLevel) {
    case 'ALTO':
      return 80;
    case 'MEDIO':
      return 50;
    case 'BAJO':
      return 20;
    default:
      return 0;
  }
}

function buildIssues(tx) {
  const issues = [];

  if (tx.decoded?.method === 'approve') {
    issues.push('Se ha detectado una aprobación de tokens');

    if (tx.decoded.is_infinite_approval) {
      issues.push('El permiso solicitado es ilimitado');
    } else {
      issues.push(`Se concede permiso al spender ${tx.decoded.spender}`);
    }
  } else if (tx.decoded?.method === 'setApprovalForAll') {
    issues.push('Se ha detectado un setApprovalForAll');

    if (tx.decoded.approved) {
      issues.push(`Se autoriza al operador ${tx.decoded.operator} para gestionar todos los activos cubiertos`);
    } else {
      issues.push(`Se revoca la autorización global del operador ${tx.decoded.operator}`);
    }
  } else {
    if (tx.is_contract_interaction) {
      issues.push('La transacción interactúa con un smart contract');
    }

    if (tx.method_selector) {
      issues.push(`Selector detectado: ${tx.method_selector}`);
    }
  }

  if (tx.has_value) {
    issues.push('La transacción envía ETH');
  }

  if (tx.origin) {
    issues.push(`Solicitud iniciada desde ${tx.origin}`);
  }

  return issues;
}

function buildContextSummary(tx) {
  const parts = [];

  if (tx.from) parts.push(`Desde: ${tx.from}`);
  if (tx.to) parts.push(`Hacia: ${tx.to}`);
  if (tx.origin) parts.push(`Origen: ${tx.origin}`);
  if (tx.method_selector) parts.push(`Selector: ${tx.method_selector}`);

  if (tx.decoded?.method === 'approve') {
    parts.push(`Método decodificado: approve`);
    parts.push(`Spender: ${tx.decoded.spender}`);
    parts.push(`Permiso ilimitado: ${tx.decoded.is_infinite_approval ? 'sí' : 'no'}`);
  }

  if (tx.decoded?.method === 'setApprovalForAll') {
    parts.push(`Método decodificado: setApprovalForAll`);
    parts.push(`Operator: ${tx.decoded.operator}`);
    parts.push(`Approved: ${tx.decoded.approved ? 'true' : 'false'}`);
  }

  if (tx.has_value) parts.push(`Valor: ${tx.value}`);

  return parts.join(' | ');
}

function buildExplanationContext(tx) {
  if (tx.decoded?.method === 'approve') {
    return `
- Se ha detectado una aprobación de tokens
- Dirección autorizada: ${tx.decoded.spender}
- Permiso ilimitado: ${tx.decoded.is_infinite_approval ? 'sí' : 'no'}
- También envía ETH: ${tx.has_value ? 'sí' : 'no'}
`;
  }

  if (tx.decoded?.method === 'setApprovalForAll') {
    return `
- Se ha detectado un permiso global sobre activos tipo NFT o similares
- Operador afectado: ${tx.decoded.operator}
- Se activa el permiso global: ${tx.decoded.approved ? 'sí' : 'no'}
- También envía ETH: ${tx.has_value ? 'sí' : 'no'}
`;
  }

  if (tx.is_contract_interaction) {
    return `
- Se ha detectado una llamada a contrato inteligente
- Selector detectado: ${tx.method_selector || 'ninguno'}
- La función exacta todavía no se ha decodificado
- También envía ETH: ${tx.has_value ? 'sí' : 'no'}
`;
  }

  return `
- Parece una transferencia simple
- Envía ETH: ${tx.has_value ? 'sí' : 'no'}
`;
}

async function explainTransaction(tx) {
  const prompt = `
Eres un asistente de seguridad para criptomonedas.
Explica EN ESPAÑOL y de forma MUY SIMPLE qué hace esta transacción.

DATOS CONFIRMADOS:
${buildExplanationContext(tx)}
- Desde: ${tx.from || 'usuario'}
- Hacia: ${tx.to || 'destino desconocido'}
- Origen: ${tx.origin || 'desconocido'}

INSTRUCCIONES:
1. Explica en 2 o 3 frases cortas
2. Habla para una persona no técnica
3. No inventes funciones ni propósitos que no estén confirmados
4. Si la función exacta no se conoce, dilo claramente
5. Si detectas un permiso, explica qué implica para el usuario

Explicación:
  `.trim();

  return await askOllama(prompt);
}

async function assessRisk(tx) {
  const prompt = `
Eres un experto en seguridad Web3.
Analiza esta transacción y responde SOLO con UNA PALABRA: BAJO, MEDIO o ALTO.

DATOS CONFIRMADOS:
- Método decodificado: ${tx.decoded?.method || 'ninguno'}
- Selector: ${tx.method_selector || 'ninguno'}
- Interacción con contrato: ${tx.is_contract_interaction ? 'sí' : 'no'}
- Envía ETH: ${tx.has_value ? 'sí' : 'no'}
- Permiso ilimitado: ${tx.decoded?.is_infinite_approval ? 'sí' : 'no'}
- Permiso global activo: ${tx.decoded?.method === 'setApprovalForAll' ? (tx.decoded.approved ? 'sí' : 'no') : 'no aplica'}
- Origen: ${tx.origin || 'desconocido'}

CRITERIOS:
- ALTO: approval ilimitado o setApprovalForAll activado
- MEDIO: llamada a contrato no decodificada o incierta
- BAJO: transferencia simple o revocación sin señales claras

Responde SOLO con: BAJO, MEDIO o ALTO

Riesgo:
  `.trim();

  const risk = await askOllama(prompt);
  return normalizeRisk(risk);
}

async function analyzeTransaction(rawTxData) {
  const tx = normalizeTx(rawTxData);
  tx.decoded = decodeKnownTransaction(tx);

  console.log('🧩 Transacción normalizada:', tx);
  console.log('🔎 Transacción decodificada:', tx.decoded);

  const [riskLevel, explanation] = await Promise.all([
    assessRisk(tx),
    explainTransaction(tx),
  ]);

  return {
    risk_level: riskLevel,
    risk_score: riskToScore(riskLevel),
    issues: buildIssues(tx),
    explanation,
    context_summary: buildContextSummary(tx),
    normalized_tx: tx,
    decoded: tx.decoded,
  };
}

module.exports = {
  analyzeTransaction,
};