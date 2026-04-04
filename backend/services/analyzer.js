const { askOllama } = require('./ollama');
const { normalizeTx } = require('./normalizeTx');
const { decodeKnownTransaction } = require('./decoder');
const { buildDeterministicVerdict } = require('./rules');
const {
  saveAnalysisHistory,
  upsertAddressCache,
  getAddressCache,
  findRecentAnalysisByTarget,
} = require('./database');

function buildContextSummary(tx) {
  const parts = [];

  if (tx.from) parts.push(`Desde: ${tx.from}`);
  if (tx.to) parts.push(`Hacia: ${tx.to}`);
  if (tx.origin) parts.push(`Origen: ${tx.origin}`);
  if (tx.method_selector) parts.push(`Selector: ${tx.method_selector}`);

  if (tx.decoded?.method === 'approve') {
    parts.push('Método: approve');
    parts.push(`Spender: ${tx.decoded.spender}`);
    parts.push(`Cantidad: ${tx.decoded.amount}`);
    parts.push(`Permiso ilimitado: ${tx.decoded.is_infinite_approval ? 'sí' : 'no'}`);
  }

  if (tx.decoded?.method === 'setApprovalForAll') {
    parts.push('Método: setApprovalForAll');
    parts.push(`Operator: ${tx.decoded.operator}`);
    parts.push(`Approved: ${tx.decoded.approved ? 'true' : 'false'}`);
  }

  if (tx.has_value) {
    parts.push(`Valor: ${tx.value}`);
  }

  return parts.join(' | ');
}

async function explainTransaction(tx, verdict) {
  const findingsText = verdict.findings.map((f, i) => `${i + 1}. ${f}`).join('\n');

  const prompt = `
  Eres un asistente de seguridad Web3.
  Explica EN ESPAÑOL y de forma MUY SIMPLE una transacción basándote SOLO en los hallazgos confirmados.

  DATOS CONFIRMADOS:
  - Riesgo calculado por reglas: ${verdict.risk_level}
  - Acción recomendada: ${verdict.recommended_action}
  - Hallazgos:
  ${findingsText}

  INSTRUCCIONES:
  1. Explica en 2 o 3 frases cortas
  2. No inventes funciones ni propósitos no confirmados
  3. Si es approve, di que es un permiso para mover tokens, NO una transferencia
  4. No uses frases raras como "por nuestra seguridad" o "se puede acceder a él"
  5. Si el permiso es limitado, dilo claramente
  6. Si el permiso es ilimitado, adviértelo claramente
  7. Habla para una persona no técnica

  Explicación:
  `.trim();

  return await askOllama(prompt);
}

async function persistLocalAddressMemory(tx) {
  const chainId = tx.chainId || null;
  const methodSelector = tx.method_selector || null;

  const tasks = [];

  if (tx.from) {
    tasks.push(
      upsertAddressCache({
        address: tx.from,
        chainId,
        label: 'sender',
        notes: 'Dirección origen observada en análisis local',
        lastMethodSelector: methodSelector,
      }),
    );
  }

  if (tx.to) {
    tasks.push(
      upsertAddressCache({
        address: tx.to,
        chainId,
        label: 'target',
        notes: 'Dirección destino observada en análisis local',
        lastMethodSelector: methodSelector,
      }),
    );
  }

  if (tx.decoded?.method === 'approve' && tx.decoded.spender) {
    tasks.push(
      upsertAddressCache({
        address: tx.decoded.spender,
        chainId,
        label: 'spender',
        notes: tx.decoded.is_infinite_approval
          ? 'Dirección observada como spender con aprobación ilimitada'
          : 'Dirección observada como spender con aprobación limitada',
        lastMethodSelector: methodSelector,
      }),
    );
  }

  if (tx.decoded?.method === 'setApprovalForAll' && tx.decoded.operator) {
    tasks.push(
      upsertAddressCache({
        address: tx.decoded.operator,
        chainId,
        label: 'operator',
        notes: tx.decoded.approved
          ? 'Dirección observada como operador con permiso global activo'
          : 'Dirección observada como operador con revocación de permiso global',
        lastMethodSelector: methodSelector,
      }),
    );
  }

  await Promise.all(tasks);
}

async function collectLocalMemorySignals(tx) {
  const chainId = tx.chainId || null;
  const signals = {
    cached_addresses: {},
    recent_similar_analysis: [],
    findings: [],
  };

  const addressesToCheck = [];

  if (tx.to) {
    addressesToCheck.push({ key: 'target', address: tx.to });
  }

  if (tx.decoded?.method === 'approve' && tx.decoded.spender) {
    addressesToCheck.push({ key: 'spender', address: tx.decoded.spender });
  }

  if (tx.decoded?.method === 'setApprovalForAll' && tx.decoded.operator) {
    addressesToCheck.push({ key: 'operator', address: tx.decoded.operator });
  }

  for (const item of addressesToCheck) {
    const cached = await getAddressCache(item.address, chainId);
    if (cached) {
      signals.cached_addresses[item.key] = cached;

      if ((cached.times_seen || 0) > 1) {
        if (item.key === 'target') {
          signals.findings.push(
            `La dirección destino ya ha aparecido antes (${cached.times_seen} veces) en análisis locales`,
          );
        } else if (item.key === 'spender') {
          signals.findings.push(
            `La dirección autorizada ya ha aparecido antes (${cached.times_seen} veces) en análisis locales`,
          );
        } else if (item.key === 'operator') {
          signals.findings.push(
            `El operador ya ha aparecido antes (${cached.times_seen} veces) en análisis locales`,
          );
        }
      }
    }
  }

  if (tx.to) {
    const recent = await findRecentAnalysisByTarget(tx.to, tx.method_selector, 10);
    signals.recent_similar_analysis = recent;

    const totalSimilar = recent.reduce((acc, row) => acc + (row.count || 0), 0);

    if (totalSimilar > 0) {
      signals.findings.push(
        `Existen ${totalSimilar} análisis recientes similares para este destino${tx.method_selector ? ' y selector' : ''}`,
      );
    }
  }

  return signals;
}

async function analyzeTransaction(rawTxData) {
  const tx = normalizeTx(rawTxData);
  tx.decoded = decodeKnownTransaction(tx);

  console.log('🧩 Transacción normalizada:', tx);
  console.log('🔎 Transacción decodificada:', tx.decoded);

  const localMemorySignals = await collectLocalMemorySignals(tx);
  console.log('🧠 Memoria local:', localMemorySignals);

  const deterministicVerdict = buildDeterministicVerdict(tx);

  if (localMemorySignals.findings.length > 0) {
    deterministicVerdict.findings = [
      ...deterministicVerdict.findings,
      ...localMemorySignals.findings,
    ];
  }

  console.log('🛡️ Veredicto determinista:', deterministicVerdict);

  const explanation = await explainTransaction(tx, deterministicVerdict);

  const analysisResult = {
    risk_level: deterministicVerdict.risk_level,
    risk_score: deterministicVerdict.risk_score,
    recommended_action: deterministicVerdict.recommended_action,
    issues: deterministicVerdict.findings,
    findings: deterministicVerdict.findings,
    explanation,
    context_summary: buildContextSummary(tx),
    normalized_tx: tx,
    decoded: tx.decoded,
    deterministic_verdict: deterministicVerdict,
    local_memory_signals: localMemorySignals,
  };

  try {
    await saveAnalysisHistory(rawTxData, analysisResult);
    await persistLocalAddressMemory(tx);
    console.log('💾 Análisis guardado en BD');
  } catch (dbError) {
    console.error('⚠️ Error guardando en BD:', dbError.message);
  }

  return analysisResult;
}

module.exports = {
  analyzeTransaction,
};