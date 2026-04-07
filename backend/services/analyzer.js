const { askOllama } = require('./ollama');
const { normalizeTx } = require('./normalizeTx');
const { decodeKnownTransaction } = require('./decoder');
const { buildDeterministicVerdict } = require('./rules');
const {
  saveAnalysisHistory,
  upsertAddressCache,
  getAddressCache,
  findRecentAnalysisByTarget,
  lookupAddress,
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

async function explainTransaction(tx, verdict, localMemorySignals = null, semanticFacts = null) {
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
1. Responde en 2 o 3 frases cortas, no más
2. No uses markdown
3. No inventes funciones ni propósitos no confirmados
4. Si es approve, di que es un permiso para mover tokens, NO una transferencia
5. Si la aprobación es ilimitada, dilo claramente
6. Si hay memoria local, menciónala solo como contexto adicional
7. No uses palabras como "sospechoso", "patrón inusual", "actividad sospechosa" o similares salvo que esté explícitamente confirmado
8. No uses lenguaje alarmista
9. Habla para una persona no técnica

Explicación:
  `.trim();

const rawExplanation = await askOllama(prompt);
return sanitizeExplanation(rawExplanation, verdict, semanticFacts || {});
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

async function collectKnownAddressSignals(tx) {
  const signals = {
    matches: {},
    findings: [],
    score_adjustment: 0,
    forced_risk_level: null,
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
    const match = await lookupAddress(item.address);

    if (!match) {
      continue;
    }

    signals.matches[item.key] = match;

    const label = match.label || 'sin etiqueta';
    const type = String(match.type || '').toLowerCase();
    const source = match.source || 'fuente desconocida';

    if (item.key === 'target') {
      signals.findings.push(
        `La dirección destino está etiquetada como "${label}" (${type || 'sin tipo'})`,
      );
    } else if (item.key === 'spender') {
      signals.findings.push(
        `La dirección autorizada está etiquetada como "${label}" (${type || 'sin tipo'})`,
      );
    } else if (item.key === 'operator') {
      signals.findings.push(
        `El operador está etiquetado como "${label}" (${type || 'sin tipo'})`,
      );
    }

    signals.findings.push(`Fuente de la etiqueta: ${source}`);

    if (type === 'scam' || type === 'blacklist' || type === 'blacklisted') {
      signals.score_adjustment += 50;
      signals.forced_risk_level = 'ALTO';
      signals.findings.push('La etiqueta indica un riesgo crítico conocido');
      continue;
    }

    if (type === 'warning' || type === 'suspicious') {
      signals.score_adjustment += 25;

      if (signals.forced_risk_level !== 'ALTO') {
        signals.forced_risk_level = 'MEDIO';
      }

      if (source.includes('darklist')) {
        signals.findings.push(
          'La dirección aparece en una darklist externa y debe considerarse de alto riesgo potencial',
        );
      } else {
        signals.findings.push(
          'La etiqueta indica una dirección que merece especial precaución',
        );
      }
      
      continue;
    }

    if (
      type === 'trusted' ||
      type === 'known_protocol' ||
      type === 'test_contract' ||
      type === 'own_contract'
    ) {
      signals.score_adjustment -= 10;
      signals.findings.push('La etiqueta aporta contexto de confianza o de prueba');
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

function containsAny(text, terms) {
  const normalized = String(text || '').toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function buildSemanticFacts(tx, deterministicVerdict, knownAddressSignals, localMemorySignals) {
  const knownMatches = Object.values(knownAddressSignals?.matches || {});
  const knownTypes = knownMatches.map((match) =>
    String(match?.type || '').toLowerCase(),
  );

  const recentSimilarCount = Array.isArray(localMemorySignals?.recent_similar_analysis)
    ? localMemorySignals.recent_similar_analysis.reduce(
        (acc, row) => acc + (row.count || 0),
        0,
      )
    : 0;

  return {
    method: tx.decoded?.method || 'unknown',
    isInfiniteApproval: !!tx.decoded?.is_infinite_approval,
    isGlobalApproval:
      tx.decoded?.method === 'setApprovalForAll' && !!tx.decoded?.approved,
    isRevocation:
      (tx.decoded?.method === 'approve' && tx.decoded?.amount === '0') ||
      (tx.decoded?.method === 'setApprovalForAll' && tx.decoded?.approved === false),
    sendsValue: !!tx.has_value,
    deterministicRisk: deterministicVerdict.risk_level,
    hasKnownAddressMatch: knownMatches.length > 0,
    hasKnownAddressRiskLabel: knownTypes.some((type) =>
      ['warning', 'suspicious', 'scam', 'blacklist', 'blacklisted'].includes(type),
    ),
    hasKnownAddressCriticalLabel: knownTypes.some((type) =>
      ['scam', 'blacklist', 'blacklisted'].includes(type),
    ),
    hasKnownAddressTrustedLabel: knownTypes.some((type) =>
      ['trusted', 'known_protocol', 'test_contract', 'own_contract'].includes(type),
    ),
    recentSimilarCount,
    repeatedTarget:
      Number(localMemorySignals?.cached_addresses?.target?.times_seen || 0) > 1,
    repeatedSensitiveAddress:
      Number(localMemorySignals?.cached_addresses?.spender?.times_seen || 0) > 1 ||
      Number(localMemorySignals?.cached_addresses?.operator?.times_seen || 0) > 1,
  };
}

function buildSafeReviewerSummary(facts) {
  if (facts.isInfiniteApproval) {
    return 'La operación requiere revisión porque concede un permiso ilimitado.';
  }

  if (facts.isGlobalApproval) {
    return 'La operación requiere revisión porque activa un permiso global.';
  }

  if (facts.hasKnownAddressCriticalLabel) {
    return 'La operación requiere revisión porque la dirección implicada está etiquetada como de alto riesgo.';
  }

  if (facts.hasKnownAddressRiskLabel) {
    return 'La operación requiere revisión porque la dirección implicada tiene una etiqueta de precaución.';
  }

  if (facts.deterministicRisk === 'MEDIO') {
    return 'La operación requiere revisión por el contexto detectado.';
  }

  return 'Sin observaciones adicionales de IA.';
}

function buildSafeExplanation(verdict, facts) {
  let sentence1 = 'Se ha detectado una operación que conviene revisar.';
  let sentence2 = '';
  let sentence3 = '';

  if (facts.method === 'approve') {
    if (facts.isInfiniteApproval) {
      sentence1 = 'Se ha detectado una aprobación de tokens con permiso ilimitado.';
      sentence2 =
        'Eso permitiría a la dirección autorizada mover tokens sin volver a pedir permiso.';
    } else if (facts.isRevocation) {
      sentence1 = 'Se ha detectado una revocación de permiso de tokens.';
      sentence2 = 'En este caso no se está concediendo un permiso nuevo amplio.';
    } else {
      sentence1 = 'Se ha detectado una aprobación de tokens con permiso limitado.';
      sentence2 = 'Eso permite mover solo la cantidad autorizada, no un permiso ilimitado.';
    }
  } else if (facts.isGlobalApproval) {
    sentence1 = 'Se ha detectado un permiso global sobre activos.';
    sentence2 =
      'Eso permitiría al operador gestionar todos los activos cubiertos por ese permiso.';
  } else if (facts.method === 'setApprovalForAll' && facts.isRevocation) {
    sentence1 = 'Se ha detectado una revocación de permiso global.';
    sentence2 = 'En este caso se está retirando la autorización previa.';
  } else if (facts.deterministicRisk === 'MEDIO') {
    sentence1 = 'Se ha detectado una interacción con contrato que requiere revisión.';
    sentence2 = 'La función concreta no es lo bastante clara como para asumir que sea segura.';
  }

  if (facts.hasKnownAddressCriticalLabel) {
    sentence3 =
      'Además, la dirección implicada está etiquetada en la base local como de alto riesgo.';
  } else if (facts.hasKnownAddressRiskLabel) {
    sentence3 =
      'Además, la dirección implicada tiene una etiqueta de precaución en la base local.';
  } else if (facts.recentSimilarCount > 0) {
    sentence3 =
      'Además, existen análisis locales similares previos, lo que aporta contexto adicional.';
  }

  return [sentence1, sentence2, sentence3].filter(Boolean).join(' ');
}

function sanitizeAiReview(aiReview, facts) {
  let aiRiskHint = normalizeAiRiskHint(
    aiReview?.ai_risk_hint,
    facts.deterministicRisk,
  );
  let confidence = normalizeConfidence(aiReview?.confidence);
  let aiFlags = Array.isArray(aiReview?.ai_flags)
    ? aiReview.ai_flags
        .filter((x) => typeof x === 'string' && x.trim())
        .slice(0, 3)
    : [];
  let reviewerSummary =
    typeof aiReview?.reviewer_summary === 'string' && aiReview.reviewer_summary.trim()
      ? aiReview.reviewer_summary.trim()
      : buildSafeReviewerSummary(facts);

  if (facts.isInfiniteApproval || facts.isGlobalApproval) {
    aiRiskHint = 'ALTO';
  }

  if (!facts.isInfiniteApproval) {
    aiFlags = aiFlags.filter((flag) => !containsAny(flag, ['ilimitad', 'sin límite', 'sin limite']));
    if (containsAny(reviewerSummary, ['ilimitad', 'sin límite', 'sin limite'])) {
      reviewerSummary = buildSafeReviewerSummary(facts);
    }
  }

  if (!facts.isGlobalApproval) {
    aiFlags = aiFlags.filter((flag) => !containsAny(flag, ['permiso global', 'global', 'todos los activos']));
    if (containsAny(reviewerSummary, ['permiso global', 'todos los activos'])) {
      reviewerSummary = buildSafeReviewerSummary(facts);
    }
  }

  if (!facts.sendsValue) {
    aiFlags = aiFlags.filter((flag) => !containsAny(flag, ['envía eth', 'envia eth']));
    if (containsAny(reviewerSummary, ['envía eth', 'envia eth'])) {
      reviewerSummary = buildSafeReviewerSummary(facts);
    }
  }

  if (!facts.hasKnownAddressRiskLabel) {
    aiFlags = aiFlags.filter(
      (flag) => !containsAny(flag, ['phishing', 'estafa', 'malicios', 'darklist', 'scam']),
    );
    if (containsAny(reviewerSummary, ['phishing', 'estafa', 'malicios', 'darklist', 'scam'])) {
      reviewerSummary = buildSafeReviewerSummary(facts);
    }
  }

  if (!reviewerSummary || reviewerSummary.length > 220) {
    reviewerSummary = buildSafeReviewerSummary(facts);
  }

  return {
    ai_risk_hint: aiRiskHint,
    confidence,
    ai_flags: aiFlags,
    reviewer_summary: reviewerSummary,
    raw_response: aiReview?.raw_response || null,
  };
}

function sanitizeExplanation(explanation, verdict, facts) {
  let text = String(explanation || '')
    .replace(/```/g, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\bM\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const hasContradiction =
    (!facts.isInfiniteApproval &&
      containsAny(text, ['ilimitad', 'sin límite', 'sin limite'])) ||
    (!facts.isGlobalApproval &&
      containsAny(text, ['permiso global', 'todos los activos', 'todos tus nft', 'todos los nfts'])) ||
    (!facts.sendsValue && containsAny(text, ['envía eth', 'envia eth'])) ||
    (!facts.hasKnownAddressRiskLabel &&
      containsAny(text, ['phishing', 'estafa', 'malicios', 'darklist', 'scam']));

  if (!text || text.length > 420 || hasContradiction) {
    return buildSafeExplanation(verdict, facts);
  }

  return text;
}



async function reviewWithAI(tx, deterministicVerdict, localMemorySignals, semanticFacts) {  let raw = null;

  const findingsText = deterministicVerdict.findings.slice(0, 6).join(' | ');
  const memoryText =
    localMemorySignals && localMemorySignals.findings.length > 0
      ? localMemorySignals.findings.slice(0, 3).join(' | ')
      : 'Sin señales adicionales';

  const prompt = `
  Devuelve SOLO JSON válido.
  No añadas texto antes ni después.
  No uses markdown.

  Eres un revisor complementario de seguridad Web3.
  No reemplazas el riesgo base.

  DATOS:
  - Riesgo base: ${deterministicVerdict.risk_level}
  - Método: ${semanticFacts.method}
  - Permiso ilimitado: ${semanticFacts.isInfiniteApproval ? 'sí' : 'no'}
  - Permiso global activo: ${semanticFacts.isGlobalApproval ? 'sí' : 'no'}
  - Revocación: ${semanticFacts.isRevocation ? 'sí' : 'no'}
  - Dirección con etiqueta de riesgo: ${semanticFacts.hasKnownAddressRiskLabel ? 'sí' : 'no'}
  - Riesgo crítico etiquetado: ${semanticFacts.hasKnownAddressCriticalLabel ? 'sí' : 'no'}
  - Análisis similares recientes: ${semanticFacts.recentSimilarCount}
  - Hallazgos: ${findingsText}
  - Memoria local: ${memoryText}

  REGLAS OBLIGATORIAS:
  - Si "Permiso ilimitado" es "sí", ai_risk_hint debe ser "ALTO"
  - Si "Permiso global activo" es "sí", ai_risk_hint debe ser "ALTO"
  - Si no hay permiso ilimitado, no hables de permiso ilimitado
  - Si no hay permiso global, no hables de permiso global
  - No inventes phishing, scam o malicia si no existe etiqueta de riesgo
  - confidence solo puede ser: "baja", "media" o "alta"
  - ai_flags debe ser un array de 0 a 3 frases cortas
  - reviewer_summary debe ser una frase breve y objetiva

  Formato exacto:
  {"ai_risk_hint":"ALTO","confidence":"media","ai_flags":["permiso ilimitado detectado","uso repetido en memoria local"],"reviewer_summary":"La operación requiere revisión por su riesgo elevado."}
  `.trim();

  try {

    const parsed = safeJsonParseFromText(raw);

    return sanitizeAiReview(
      {
        ai_risk_hint: parsed.ai_risk_hint,
        confidence: parsed.confidence,
        ai_flags: parsed.ai_flags,
        reviewer_summary: parsed.reviewer_summary,
        raw_response: raw,
      },
      semanticFacts,
    );
  } catch (error) {

   return sanitizeAiReview(
      {
        ai_risk_hint: deterministicVerdict.risk_level,
        confidence: 'baja',
        ai_flags: [],
        reviewer_summary: 'No se pudieron generar observaciones adicionales de IA',
        raw_response: raw,
      },
      semanticFacts,
    );     
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
  const knownAddressSignals = await collectKnownAddressSignals(tx);
  console.log('🏷️ Direcciones conocidas:', knownAddressSignals);
  const deterministicVerdict = buildDeterministicVerdict(tx);
  const semanticFacts = buildSemanticFacts(
    tx,
    deterministicVerdict,
    knownAddressSignals,
    localMemorySignals,
  );
  console.log('🧱 Hechos semánticos:', semanticFacts);


  if (localMemorySignals.findings.length > 0) {
    deterministicVerdict.findings = [
      ...deterministicVerdict.findings,
      ...localMemorySignals.findings,
    ];
  }

  if (knownAddressSignals.findings.length > 0) {
    deterministicVerdict.findings = [
      ...deterministicVerdict.findings,
      ...knownAddressSignals.findings,
    ];
  }

  if (knownAddressSignals.score_adjustment !== 0) {
    deterministicVerdict.risk_score = Math.max(
      0,
      Math.min(100, deterministicVerdict.risk_score + knownAddressSignals.score_adjustment),
    );
  }

  if (knownAddressSignals.forced_risk_level === 'ALTO') {
    deterministicVerdict.risk_level = 'ALTO';
    deterministicVerdict.recommended_action = 'REVIEW';
  } else if (
    knownAddressSignals.forced_risk_level === 'MEDIO' &&
    deterministicVerdict.risk_level === 'BAJO'
  ) {
    deterministicVerdict.risk_level = 'MEDIO';
    deterministicVerdict.recommended_action = 'REVIEW';
  }

    const aiReview = await reviewWithAI(
    tx,
    deterministicVerdict,
    localMemorySignals,
    semanticFacts,
  );

  console.log('🤖 Revisión IA:', aiReview);

  const finalVerdict = fuseVerdicts(deterministicVerdict, aiReview);
  console.log('⚖️ Veredicto final:', finalVerdict);

  console.log('🛡️ Veredicto determinista:', deterministicVerdict);

  const explanation = await explainTransaction(
    tx,
    deterministicVerdict,
    localMemorySignals,
    semanticFacts
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
    known_address_signals: knownAddressSignals,
    ai_review: aiReview,
    final_verdict: finalVerdict,
    semantic_facts: semanticFacts,
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