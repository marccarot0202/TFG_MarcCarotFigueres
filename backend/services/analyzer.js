const { askOllama } = require('./ollama');
const { normalizeTx } = require('./normalizeTx');
const { decodeKnownTransaction } = require('./decoder');
const { buildDeterministicVerdict } = require('./rules');
const {
  saveAnalysisHistory,
  updateAnalysisPerformance,
  upsertAddressCache,
  getAddressCache,
  findRecentAnalysisByTarget,
  lookupAddress,
} = require('./database');

function buildContextSummary(tx) {
  const parts = [];

  if (tx.from) parts.push(`Des de: ${tx.from}`);
  if (tx.to) parts.push(`Cap a: ${tx.to}`);
  if (tx.origin) parts.push(`Origen: ${tx.origin}`);
  if (tx.method_selector) parts.push(`Selector: ${tx.method_selector}`);

  if (tx.decoded?.method === 'approve') {
    parts.push('Mètode: approve');
    parts.push(`Spender: ${tx.decoded.spender}`);
    parts.push(`Quantitat: ${tx.decoded.amount}`);
    parts.push(
      `Permís il·limitat: ${tx.decoded.is_infinite_approval ? 'sí' : 'no'}`,
    );
  }

  if (tx.decoded?.method === 'setApprovalForAll') {
    parts.push('Mètode: setApprovalForAll');
    parts.push(`Operador: ${tx.decoded.operator}`);
    parts.push(`Aprovat: ${tx.decoded.approved ? 'sí' : 'no'}`);
  }

  if (tx.has_value) {
    parts.push(`Valor: ${tx.value}`);
  }

  return parts.join(' | ');
}

async function explainTransaction(
  tx,
  verdict,
  localMemorySignals = null,
  semanticFacts = null,
) {
  const findingsText = verdict.findings
    .map((f, i) => `${i + 1}. ${f}`)
    .join('\n');

  const memoryText =
    localMemorySignals && localMemorySignals.findings.length > 0
      ? localMemorySignals.findings.map((f, i) => `M${i + 1}. ${f}`).join('\n')
      : 'No hi ha senyals addicionals de memòria local';

  const prompt = `
Ets un assistent de seguretat Web3.
Explica EN CATALÀ i de manera MOLT SENZILLA una transacció basant-te NOMÉS en els indicis confirmats.

DADES CONFIRMADES:
- Risc calculat per les regles: ${verdict.risk_level}
- Acció recomanada: ${verdict.recommended_action}

INDICIS PRINCIPALS:
${findingsText}

MEMÒRIA LOCAL:
${memoryText}

INSTRUCCIONS:
1. Respon en 2 o 3 frases curtes, no més
2. No facis servir markdown
3. No inventis funcions ni finalitats no confirmades
4. Si és approve, digues que és un permís per moure tokens, NO una transferència
5. Si l'aprovació és il·limitada, digues-ho clarament
6. Si hi ha memòria local, esmenta-la només com a context addicional
7. No facis servir paraules com "sospitós", "patró inusual", "activitat sospitosa" o similars, tret que estigui confirmat explícitament
8. No facis servir llenguatge alarmista
9. Parla per a una persona no tècnica

Explicació:
  `.trim();

  try {
    const rawExplanation = await askOllama(prompt);
    return sanitizeExplanation(rawExplanation, verdict, semanticFacts || {});
  } catch (error) {
    console.error("⚠️ Error generant l'explicació amb IA:", error.message);
    return buildSafeExplanation(verdict, semanticFacts || {});
  }
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
        notes: "Adreça d'origen observada en una anàlisi local",
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
        notes: 'Adreça de destinació observada en una anàlisi local',
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
          ? 'Adreça observada com a spender amb una aprovació il·limitada'
          : 'Adreça observada com a spender amb una aprovació limitada',
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
          ? 'Adreça observada com a operador amb un permís global actiu'
          : 'Adreça observada com a operador amb una revocació del permís global',
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
            `L'adreça de destinació ja ha aparegut abans (${cached.times_seen} vegades) en anàlisis locals`,
          );
        } else if (item.key === 'spender') {
          signals.findings.push(
            `L'adreça autoritzada ja ha aparegut abans (${cached.times_seen} vegades) en anàlisis locals`,
          );
        } else if (item.key === 'operator') {
          signals.findings.push(
            `L'operador ja ha aparegut abans (${cached.times_seen} vegades) en anàlisis locals`,
          );
        }
      }
    }
  }

  if (tx.to) {
    const recent = await findRecentAnalysisByTarget(
      tx.to,
      tx.method_selector,
      10,
    );
    signals.recent_similar_analysis = recent;

    const totalSimilar = recent.reduce((acc, row) => acc + (row.count || 0), 0);

    if (totalSimilar > 0) {
      signals.findings.push(
        `Hi ha ${totalSimilar} anàlisis recents similars per a aquesta destinació${tx.method_selector ? ' i aquest selector' : ''}`,
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

    const label = match.label || 'sense etiqueta';
    const type = String(match.type || '').toLowerCase();
    const source = match.source || 'font desconeguda';

    if (item.key === 'target') {
      signals.findings.push(
        `L'adreça de destinació està etiquetada com a "${label}" (${type || 'sense tipus'})`,
      );
    } else if (item.key === 'spender') {
      signals.findings.push(
        `L'adreça autoritzada està etiquetada com a "${label}" (${type || 'sense tipus'})`,
      );
    } else if (item.key === 'operator') {
      signals.findings.push(
        `L'operador està etiquetat com a "${label}" (${type || 'sense tipus'})`,
      );
    }

    signals.findings.push(`Font de l'etiqueta: ${source}`);

    if (type === 'scam' || type === 'blacklist' || type === 'blacklisted') {
      signals.score_adjustment += 50;
      signals.forced_risk_level = 'ALTO';
      signals.findings.push("L'etiqueta indica un risc crític conegut");
      continue;
    }

    if (type === 'warning' || type === 'suspicious') {
      signals.score_adjustment += 25;

      if (signals.forced_risk_level !== 'ALTO') {
        signals.forced_risk_level = 'MEDIO';
      }

      if (source.includes('darklist')) {
        signals.findings.push(
          "L'adreça apareix en una llista fosca externa i s'ha de considerar de risc potencial alt",
        );
      } else {
        signals.findings.push(
          "L'etiqueta indica una adreça que requereix una precaució especial",
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
      signals.findings.push(
        "L'etiqueta aporta context de confiança o de prova",
      );
    }
  }

  return signals;
}

function safeJsonParseFromText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Resposta buida o no textual');
  }

  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }

  if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
    try {
      return JSON.parse(`${trimmed}}`);
    } catch (_) {}
  }

  throw new Error("No s'ha pogut extreure un JSON vàlid");
}

function normalizeAiRiskHint(value, fallback) {
  const text = String(value || '')
    .trim()
    .toUpperCase();

  if (text === 'BAJO' || text === 'BAIX') return 'BAJO';
  if (text === 'MEDIO' || text === 'MITJÀ' || text === 'MITJA') return 'MEDIO';
  if (text === 'ALTO' || text === 'ALT') return 'ALTO';

  return fallback;
}

function normalizeConfidence(value) {
  const text = String(value || '')
    .trim()
    .toLowerCase();

  if (text === 'baja' || text === 'baixa') return 'baja';
  if (
    text === 'media' ||
    text === 'medio' ||
    text === 'mitjana' ||
    text === 'mitjà' ||
    text === 'mitja'
  ) {
    return 'media';
  }
  if (text === 'alta') return 'alta';

  return 'media';
}

function containsAny(text, terms) {
  const normalized = String(text || '').toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

const unlimitedPermissionTerms = [
  'ilimitad',
  'sin límite',
  'sin limite',
  'il·limit',
  'sense límit',
  'sense limit',
];

const globalPermissionTerms = [
  'permiso global',
  'global',
  'todos los activos',
  'todos tus nft',
  'todos los nfts',
  'permís global',
  'tots els actius',
  'tots els teus nft',
  'tots els nfts',
];

const ethTransferTerms = ['envía eth', 'envia eth'];

const maliciousActivityTerms = [
  'phishing',
  'estafa',
  'malicios',
  'maliciós',
  'maliciosa',
  'darklist',
  'llista fosca',
  'scam',
];

const tokenPermissionTerms = [
  'permiso para mover token',
  'se permite mover token',
  'permite mover token',
  'autorizado a mover token',
  'autorizada a mover token',
  'aprobación de token',
  'aprobacion de token',
  'autorización de token',
  'autorizacion de token',
  'permís per moure token',
  'es permet moure token',
  'permet moure token',
  'autoritzat a moure token',
  'autoritzada a moure token',
  'aprovació de token',
  'autorització de token',
];

function buildSemanticFacts(
  tx,
  deterministicVerdict,
  knownAddressSignals,
  localMemorySignals,
) {
  const knownMatches = Object.values(knownAddressSignals?.matches || {});
  const knownTypes = knownMatches.map((match) =>
    String(match?.type || '').toLowerCase(),
  );

  const recentSimilarCount = Array.isArray(
    localMemorySignals?.recent_similar_analysis,
  )
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
      (tx.decoded?.method === 'setApprovalForAll' &&
        tx.decoded?.approved === false),
    sendsValue: !!tx.has_value,
    deterministicRisk: deterministicVerdict.risk_level,
    hasKnownAddressMatch: knownMatches.length > 0,
    hasKnownAddressRiskLabel: knownTypes.some((type) =>
      ['warning', 'suspicious', 'scam', 'blacklist', 'blacklisted'].includes(
        type,
      ),
    ),
    hasKnownAddressCriticalLabel: knownTypes.some((type) =>
      ['scam', 'blacklist', 'blacklisted'].includes(type),
    ),
    hasKnownAddressTrustedLabel: knownTypes.some((type) =>
      ['trusted', 'known_protocol', 'test_contract', 'own_contract'].includes(
        type,
      ),
    ),
    recentSimilarCount,
    repeatedTarget:
      Number(localMemorySignals?.cached_addresses?.target?.times_seen || 0) > 1,
    repeatedSensitiveAddress:
      Number(localMemorySignals?.cached_addresses?.spender?.times_seen || 0) >
        1 ||
      Number(localMemorySignals?.cached_addresses?.operator?.times_seen || 0) >
        1,
  };
}

function buildSafeReviewerSummary(facts) {
  if (facts.isInfiniteApproval) {
    return "L'operació requereix revisió perquè concedeix un permís il·limitat.";
  }

  if (facts.isGlobalApproval) {
    return "L'operació requereix revisió perquè activa un permís global.";
  }

  if (facts.hasKnownAddressCriticalLabel) {
    return "L'operació requereix revisió perquè l'adreça implicada està etiquetada com de risc alt.";
  }

  if (facts.hasKnownAddressRiskLabel) {
    return "L'operació requereix revisió perquè l'adreça implicada té una etiqueta de precaució.";
  }

  if (facts.deterministicRisk === 'MEDIO') {
    return "L'operació requereix revisió pel context detectat.";
  }

  return 'Sense observacions addicionals de la IA.';
}

function buildSafeExplanation(verdict, facts) {
  let sentence1 = "S'ha detectat una operació que convé revisar.";
  let sentence2 = '';
  let sentence3 = '';

  if (facts.method === 'approve') {
    if (facts.isInfiniteApproval) {
      sentence1 =
        "S'ha detectat una aprovació de tokens amb un permís il·limitat.";
      sentence2 =
        "Això permetria a l'adreça autoritzada moure tokens sense tornar a demanar permís.";
    } else if (facts.isRevocation) {
      sentence1 = "S'ha detectat una revocació del permís de tokens.";
      sentence2 = "En aquest cas no s'està concedint cap permís ampli nou.";
    } else {
      sentence1 =
        "S'ha detectat una aprovació de tokens amb un permís limitat.";
      sentence2 =
        'Això permet moure només la quantitat autoritzada, no concedeix un permís il·limitat.';
    }
  } else if (facts.isGlobalApproval) {
    sentence1 = "S'ha detectat un permís global sobre actius.";
    sentence2 =
      "Això permetria a l'operador gestionar tots els actius coberts per aquest permís.";
  } else if (facts.method === 'setApprovalForAll' && facts.isRevocation) {
    sentence1 = "S'ha detectat una revocació del permís global.";
    sentence2 = "En aquest cas s'està retirant l'autorització prèvia.";
  } else if (facts.deterministicRisk === 'MEDIO') {
    sentence1 =
      "S'ha detectat una interacció amb un contracte que requereix revisió.";
    sentence2 =
      'La funció concreta no és prou clara per considerar que sigui segura.';
  } else if (facts.deterministicRisk === 'BAJO') {
    sentence1 =
      'Sembla una transferència simple sense indicadors addicionals de risc.';
    sentence2 = "No s'ha detectat cap permís de tokens en aquesta operació.";
  }

  if (facts.hasKnownAddressCriticalLabel) {
    sentence3 =
      "A més, l'adreça implicada està etiquetada a la base local com de risc alt.";
  } else if (facts.hasKnownAddressRiskLabel) {
    sentence3 =
      "A més, l'adreça implicada té una etiqueta de precaució a la base local.";
  } else if (facts.recentSimilarCount > 0) {
    sentence3 =
      'A més, hi ha anàlisis locals similars prèvies, fet que aporta context addicional.';
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
    typeof aiReview?.reviewer_summary === 'string' &&
    aiReview.reviewer_summary.trim()
      ? aiReview.reviewer_summary.trim()
      : buildSafeReviewerSummary(facts);

  if (facts.isInfiniteApproval || facts.isGlobalApproval) {
    aiRiskHint = 'ALTO';
  }

  const hasObjectiveEscalationSignal =
    facts.isInfiniteApproval ||
    facts.isGlobalApproval ||
    facts.hasKnownAddressRiskLabel;

  if (facts.deterministicRisk === 'BAJO' && !hasObjectiveEscalationSignal) {
    aiRiskHint = 'BAJO';
    reviewerSummary = buildSafeReviewerSummary(facts);
  }

  if (!facts.isInfiniteApproval) {
    aiFlags = aiFlags.filter(
      (flag) => !containsAny(flag, unlimitedPermissionTerms),
    );
    if (containsAny(reviewerSummary, unlimitedPermissionTerms)) {
      reviewerSummary = buildSafeReviewerSummary(facts);
    }
  }

  if (!facts.isGlobalApproval) {
    aiFlags = aiFlags.filter(
      (flag) => !containsAny(flag, globalPermissionTerms),
    );
    if (containsAny(reviewerSummary, globalPermissionTerms)) {
      reviewerSummary = buildSafeReviewerSummary(facts);
    }
  }

  if (!facts.sendsValue) {
    aiFlags = aiFlags.filter((flag) => !containsAny(flag, ethTransferTerms));
    if (containsAny(reviewerSummary, ethTransferTerms)) {
      reviewerSummary = buildSafeReviewerSummary(facts);
    }
  }

  if (!facts.hasKnownAddressRiskLabel) {
    aiFlags = aiFlags.filter(
      (flag) => !containsAny(flag, maliciousActivityTerms),
    );
    if (containsAny(reviewerSummary, maliciousActivityTerms)) {
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
      containsAny(text, unlimitedPermissionTerms)) ||
    (!facts.isGlobalApproval && containsAny(text, globalPermissionTerms)) ||
    (!facts.sendsValue && containsAny(text, ethTransferTerms)) ||
    (!facts.hasKnownAddressRiskLabel &&
      containsAny(text, maliciousActivityTerms)) ||
    (facts.method !== 'approve' &&
      facts.method !== 'setApprovalForAll' &&
      containsAny(text, tokenPermissionTerms));

  if (!text || text.length > 420 || hasContradiction) {
    return buildSafeExplanation(verdict, facts);
  }

  return text;
}

async function reviewWithAI(
  tx,
  deterministicVerdict,
  localMemorySignals,
  semanticFacts,
) {
  let raw = null;

  const findingsText = deterministicVerdict.findings.slice(0, 6).join(' | ');
  const memoryText =
    localMemorySignals && localMemorySignals.findings.length > 0
      ? localMemorySignals.findings.slice(0, 3).join(' | ')
      : 'Sense senyals addicionals';

  const prompt = `
Retorna NOMÉS JSON vàlid.
No afegeixis text ni abans ni després.
No facis servir markdown.

Ets un revisor complementari de seguretat Web3.
No substitueixis el risc base.

DADES:
- Risc base: ${deterministicVerdict.risk_level}
- Mètode: ${semanticFacts.method}
- Permís il·limitat: ${semanticFacts.isInfiniteApproval ? 'sí' : 'no'}
- Permís global actiu: ${semanticFacts.isGlobalApproval ? 'sí' : 'no'}
- Revocació: ${semanticFacts.isRevocation ? 'sí' : 'no'}
- Adreça amb etiqueta de risc: ${semanticFacts.hasKnownAddressRiskLabel ? 'sí' : 'no'}
- Risc crític etiquetat: ${semanticFacts.hasKnownAddressCriticalLabel ? 'sí' : 'no'}
- Anàlisis similars recents: ${semanticFacts.recentSimilarCount}
- Indicis: ${findingsText}
- Memòria local: ${memoryText}

REGLES OBLIGATÒRIES:
- Si "Permís il·limitat" és "sí", ai_risk_hint ha de ser "ALTO"
- Si "Permís global actiu" és "sí", ai_risk_hint ha de ser "ALTO"
- Si no hi ha cap permís il·limitat, no parlis de permisos il·limitats
- Si no hi ha cap permís global, no parlis de permisos globals
- No inventis phishing, scam ni intencions malicioses si no hi ha cap etiqueta de risc
- confidence només pot ser: "baja", "media" o "alta"
- ai_flags ha de ser un array de 0 a 3 frases curtes escrites en català
- reviewer_summary ha de ser una frase breu i objectiva escrita en català

Format exacte:
{"ai_risk_hint":"ALTO","confidence":"media","ai_flags":["permís il·limitat detectat","ús repetit en la memòria local"],"reviewer_summary":"L'operació requereix revisió pel seu risc elevat."}
  `.trim();

  try {
    raw = await askOllama(prompt);
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
    console.error('⚠️ Error en el revisor de la IA:', error.message);
    console.error('⚠️ Resposta en brut del revisor de la IA:', raw);

    return sanitizeAiReview(
      {
        ai_risk_hint: deterministicVerdict.risk_level,
        confidence: 'baja',
        ai_flags: [],
        reviewer_summary:
          "No s'han pogut generar observacions addicionals de la IA",
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
      reason: 'El motor determinista ha detectat un patró crític conegut',
    };
  }

  if (baseRisk === 'MEDIO' && aiRisk === 'ALTO') {
    return {
      risk_level: 'ALTO',
      source: 'hybrid_escalation',
      reason: 'La IA reforça la cautela sobre un cas que ja era incert',
    };
  }

  if (baseRisk === 'BAJO' && aiRisk === 'ALTO') {
    return {
      risk_level: 'MEDIO',
      source: 'ai_escalation',
      reason:
        'La IA ha detectat senyals addicionals que justifiquen més cautela',
    };
  }

  return {
    risk_level: baseRisk,
    source: 'deterministic_base',
    reason: 'No hi ha hagut motius suficients per alterar el veredicte base',
  };
}

async function analyzeTransaction(rawTxData) {
  const analysisStartedAt = Date.now();
  const tx = normalizeTx(rawTxData);
  tx.decoded = decodeKnownTransaction(tx);

  console.log('🧩 Transacció normalitzada:', tx);
  console.log('🔎 Transacció descodificada:', tx.decoded);

  const localMemorySignals = await collectLocalMemorySignals(tx);
  console.log('🧠 Memòria local:', localMemorySignals);

  const knownAddressSignals = await collectKnownAddressSignals(tx);
  console.log('🏷️ Adreces conegudes:', knownAddressSignals);

  const deterministicVerdict = buildDeterministicVerdict(tx);

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
      Math.min(
        100,
        deterministicVerdict.risk_score + knownAddressSignals.score_adjustment,
      ),
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

  const semanticFacts = buildSemanticFacts(
    tx,
    deterministicVerdict,
    knownAddressSignals,
    localMemorySignals,
  );
  console.log('🧱 Fets semàntics:', semanticFacts);

  const aiReviewStartedAt = Date.now();
  const aiReview = await reviewWithAI(
    tx,
    deterministicVerdict,
    localMemorySignals,
    semanticFacts,
  );
  const aiReviewMs = Date.now() - aiReviewStartedAt;
  console.log('🤖 Revisió de la IA:', aiReview);

  const finalVerdict = fuseVerdicts(deterministicVerdict, aiReview);
  console.log('⚖️ Veredicte final:', finalVerdict);

  console.log('🛡️ Veredicte determinista:', deterministicVerdict);

  const explanationStartedAt = Date.now();
  const explanation = await explainTransaction(
    tx,
    deterministicVerdict,
    localMemorySignals,
    semanticFacts,
  );
  const explanationMs = Date.now() - explanationStartedAt;

  const performance = {
    started_at: new Date(analysisStartedAt).toISOString(),
    ai_review_ms: aiReviewMs,
    explanation_ms: explanationMs,
    pre_persistence_ms: Date.now() - analysisStartedAt,
    persistence_ms: null,
    total_backend_ms: null,
  };

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
    analysis_id: null,
    performance,
    evaluation: rawTxData.evaluation || null,
  };

  try {
    const persistenceStartedAt = Date.now();
    const analysisId = await saveAnalysisHistory(rawTxData, analysisResult);
    analysisResult.analysis_id = analysisId;
    await persistLocalAddressMemory(tx);
    performance.persistence_ms = Date.now() - persistenceStartedAt;
    performance.total_backend_ms = Date.now() - analysisStartedAt;
    await updateAnalysisPerformance(analysisId, performance);
    console.log('💾 Anàlisi desada a la base de dades');
  } catch (dbError) {
    performance.total_backend_ms = Date.now() - analysisStartedAt;
    console.error(
      "⚠️ Error desant l'anàlisi a la base de dades:",
      dbError.message,
    );
  }

  return analysisResult;
}

module.exports = {
  analyzeTransaction,
  sanitizeAiReview,
  sanitizeExplanation,
};
