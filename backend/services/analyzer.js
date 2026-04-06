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

async function explainTransaction(tx, verdict, localMemorySignals = null) {
  const findingsText = verdict.findings.map((f, i) => `${i + 1}. ${f}`).join('\n');

  const memoryText =
    localMemorySignals && localMemorySignals.findings.length > 0
      ? localMemorySignals.findings.map((f, i) => `M${i + 1}. ${f}`).join('\n')
      : 'No hay señales adicionales de memoria local';

  const prompt = `
Eres un asistente de seguridad Web3.
Explica EN ESPAÑOL y de forma MUY SIMPLE una transacción basándote SOLO en los hallazgos confirmados.

DATOS CONFIRMADOS:
- Riesgo calculado por reglas: ${verdict.risk_level}
- Acción recomendada: ${verdict.recommended_action}

HALLAZGOS PRINCIPALES:
${findingsText}

MEMORIA LOCAL:
${memoryText}

INSTRUCCIONES:
1. Explica en 3 o 4 frases cortas
2. No inventes funciones ni propósitos no confirmados
3. Si es approve, di que es un permiso para mover tokens, NO una transferencia
4. Si es setApprovalForAll, di que es un permiso global
5. Si hay memoria local relevante, menciónala brevemente como contexto adicional
6. No uses lenguaje dramático ni alarmista
7. No digas cosas como "nuestro proyecto" o "nuestra seguridad"
8. Habla para una persona no técnica

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

function safeJsonParseFromText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Respuesta vacía o no textual');
  }

  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }

  if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
    try {
      return JSON.parse(`${trimmed}}`);
    } catch (_) {
    }
  }

  throw new Error('No se pudo extraer un JSON válido');
}

function normalizeAiRiskHint(value, fallback) {
  const text = String(value || '').trim().toUpperCase();

  if (text === 'BAJO') return 'BAJO';
  if (text === 'MEDIO') return 'MEDIO';
  if (text === 'ALTO') return 'ALTO';

  return fallback;
}

function normalizeConfidence(value) {
  const text = String(value || '').trim().toLowerCase();

  if (text === 'baja') return 'baja';
  if (text === 'media' || text === 'medio') return 'media';
  if (text === 'alta') return 'alta';

  return 'media';
}

async function reviewWithAI(tx, deterministicVerdict, localMemorySignals) {
  let raw = null;

  const findingsText = deterministicVerdict.findings.slice(0, 6).join(' | ');
  const memoryText =
    localMemorySignals && localMemorySignals.findings.length > 0
      ? localMemorySignals.findings.slice(0, 3).join(' | ')
      : 'Sin señales adicionales';

  const prompt = `
Devuelve SOLO JSON válido.

Analiza esta transacción Web3 como revisor complementario.
No reemplaces el riesgo base.

Riesgo base: ${deterministicVerdict.risk_level}
Método: ${tx.decoded?.method || 'ninguno'}
Selector: ${tx.method_selector || 'ninguno'}
Hallazgos: ${findingsText}
Memoria local: ${memoryText}

Formato exacto:
{"ai_risk_hint":"BAJO|MEDIO|ALTO","confidence":"baja|media|alta","ai_flags":["observación breve 1","observación breve 2"],"reviewer_summary":"frase breve"}
  `.trim();

  try {
    raw = await askOllama(prompt);
    const parsed = safeJsonParseFromText(raw);

    return {
      
      ai_risk_hint: normalizeAiRiskHint(
        parsed.ai_risk_hint,
        deterministicVerdict.risk_level,
      ),
      confidence: normalizeConfidence(parsed.confidence),
      ai_flags: Array.isArray(parsed.ai_flags)
        ? parsed.ai_flags.filter((x) => typeof x === 'string' && x.trim()).slice(0, 3)
        : [],
      reviewer_summary:
        typeof parsed.reviewer_summary === 'string' && parsed.reviewer_summary.trim()
          ? parsed.reviewer_summary.trim()
          : 'Sin observaciones adicionales de IA',
      raw_response: raw,
    };
  } catch (error) {
    console.error('⚠️ Error en AI reviewer:', error.message);
    console.error('⚠️ Raw AI reviewer response:', raw);

    return {
      ai_risk_hint: deterministicVerdict.risk_level,
      confidence: 'baja',
      ai_flags: [],
      reviewer_summary: 'No se pudieron generar observaciones adicionales de IA',
      raw_response: raw,
    };
  }
}

function fuseVerdicts(deterministicVerdict, aiReview) {
  const baseRisk = deterministicVerdict.risk_level;
  const aiRisk = aiReview?.ai_risk_hint || baseRisk;

  if (baseRisk === 'ALTO') {
    return {
      risk_level: 'ALTO',
      source: 'deterministic_priority',
      reason: 'El motor determinista detectó un patrón crítico conocido',
    };
  }

  if (baseRisk === 'MEDIO' && aiRisk === 'ALTO') {
    return {
      risk_level: 'ALTO',
      source: 'hybrid_escalation',
      reason: 'La IA refuerza la cautela sobre un caso ya incierto',
    };
  }

  if (baseRisk === 'BAJO' && aiRisk === 'ALTO') {
    return {
      risk_level: 'MEDIO',
      source: 'ai_escalation',
      reason: 'La IA detectó señales adicionales que justifican mayor cautela',
    };
  }

  return {
    risk_level: baseRisk,
    source: 'deterministic_base',
    reason: 'No hubo motivos suficientes para alterar el veredicto base',
  };
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

    const aiReview = await reviewWithAI(
    tx,
    deterministicVerdict,
    localMemorySignals,
  );

  console.log('🤖 Revisión IA:', aiReview);

  const finalVerdict = fuseVerdicts(deterministicVerdict, aiReview);
  console.log('⚖️ Veredicto final:', finalVerdict);

  console.log('🛡️ Veredicto determinista:', deterministicVerdict);

  const explanation = await explainTransaction(
    tx,
    deterministicVerdict,
    localMemorySignals,
  );

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
    ai_review: aiReview,
    final_verdict: finalVerdict,
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