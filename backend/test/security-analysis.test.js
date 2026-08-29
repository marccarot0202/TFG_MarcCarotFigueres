const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { decodeKnownTransaction } = require('../services/decoder');
const { buildDeterministicVerdict } = require('../services/rules');
const {
  sanitizeAiReview,
  sanitizeExplanation,
} = require('../services/analyzer');

const MAX_UINT256_HEX = 'f'.repeat(64);
const SPENDER = '1234567890abcdef1234567890abcdef12345678';
const APPROVE_DATA = `0x095ea7b3${'0'.repeat(24)}${SPENDER}${MAX_UINT256_HEX}`;

function buildApproveData(amount) {
  return `0x095ea7b3${'0'.repeat(24)}${SPENDER}${amount
    .toString(16)
    .padStart(64, '0')}`;
}

test('decodes the inherited ERC20 approve selector as an infinite approval', () => {
  const decoded = decodeKnownTransaction({
    method_selector: '0x095ea7b3',
    data: APPROVE_DATA,
  });

  assert.equal(decoded.method, 'approve');
  assert.equal(decoded.spender, `0x${SPENDER}`);
  assert.equal(decoded.is_infinite_approval, true);
});

test('classifies an infinite ERC20 approval as high risk', () => {
  const decoded = decodeKnownTransaction({
    method_selector: '0x095ea7b3',
    data: APPROVE_DATA,
  });
  const verdict = buildDeterministicVerdict({ decoded });

  assert.equal(verdict.risk_level, 'ALTO');
  assert.equal(verdict.risk_score, 90);
  assert.equal(verdict.recommended_action, 'REVIEW');
});

test('keeps a finite ERC20 approval at low risk', () => {
  const data = buildApproveData(2000n);
  const decoded = decodeKnownTransaction({
    method_selector: '0x095ea7b3',
    data,
  });
  const verdict = buildDeterministicVerdict({ decoded });

  assert.equal(decoded.is_infinite_approval, false);
  assert.equal(verdict.risk_level, 'BAJO');
  assert.equal(verdict.risk_score, 20);
  assert.equal(verdict.recommended_action, 'ALLOW');
});

test('classifies approve with amount zero as a low-risk revocation', () => {
  const data = buildApproveData(0n);
  const decoded = decodeKnownTransaction({
    method_selector: '0x095ea7b3',
    data,
  });
  const verdict = buildDeterministicVerdict({ decoded });

  assert.equal(decoded.amount, '0');
  assert.equal(verdict.risk_level, 'BAJO');
  assert.equal(verdict.risk_score, 5);
  assert.equal(verdict.recommended_action, 'ALLOW');
});

test('prevents AI from escalating low risk without an objective signal', () => {
  const review = sanitizeAiReview(
    {
      ai_risk_hint: 'ALT',
      confidence: 'mitjana',
      ai_flags: ['uso repetido en memoria local'],
      reviewer_summary: 'La operacion requiere revision por riesgo elevado',
      raw_response: '{"ai_risk_hint":"ALTO"}',
    },
    {
      deterministicRisk: 'BAJO',
      isInfiniteApproval: false,
      isGlobalApproval: false,
      sendsValue: false,
      hasKnownAddressRiskLabel: false,
    },
  );

  assert.equal(review.ai_risk_hint, 'BAJO');
  assert.equal(
    review.reviewer_summary,
    'Sense observacions addicionals de la IA.',
  );
  assert.equal(review.confidence, 'media');
  assert.equal(review.raw_response, '{"ai_risk_hint":"ALTO"}');
});

test('removes invented token permissions from a simple transaction explanation', () => {
  const explanation = sanitizeExplanation(
    'Parece una transferencia simple. Se trata de un permiso para mover tokens.',
    { risk_level: 'BAJO' },
    {
      method: 'unknown',
      deterministicRisk: 'BAJO',
      isInfiniteApproval: false,
      isGlobalApproval: false,
      sendsValue: false,
      hasKnownAddressRiskLabel: false,
    },
  );

  assert.match(explanation, /transferència simple/);
  assert.doesNotMatch(explanation, /permiso para mover tokens/);
});

test('removes equivalent Catalan wording that invents token movement', () => {
  const explanation = sanitizeExplanation(
    'La transacció és segura. Es permet moure tokens perquè el risc calculat és baix.',
    { risk_level: 'BAJO' },
    {
      method: 'unknown',
      deterministicRisk: 'BAJO',
      isInfiniteApproval: false,
      isGlobalApproval: false,
      sendsValue: false,
      hasKnownAddressRiskLabel: false,
    },
  );

  assert.match(explanation, /transferència simple/);
  assert.doesNotMatch(explanation, /permet moure tokens/);
});

test('migrates and persists the complete analysis without changing old columns', async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tfg-db-test-'),
  );
  const databasePath = path.join(temporaryDirectory, 'history.db');
  process.env.WEB3_SECURITY_DB_PATH = databasePath;

  const database = require('../services/database');

  try {
    await database.initDB();

    const rawTx = {
      chainId: '0xaa36a7',
      from: `0x${'1'.repeat(40)}`,
      to: `0x${'2'.repeat(40)}`,
      value: '0x0',
      data: APPROVE_DATA,
      origin: 'http://localhost:8000',
    };
    const analysis = {
      risk_level: 'ALTO',
      risk_score: 90,
      recommended_action: 'REVIEW',
      findings: ["L'aprovació és il·limitada"],
      explanation: 'Explicació de prova',
      context_summary: 'Mètode: approve',
      normalized_tx: {
        ...rawTx,
        method_selector: '0x095ea7b3',
      },
      decoded: decodeKnownTransaction({
        method_selector: '0x095ea7b3',
        data: APPROVE_DATA,
      }),
      deterministic_verdict: { risk_level: 'ALTO' },
      local_memory_signals: { findings: ['Context local'] },
      known_address_signals: { matches: {}, findings: [] },
      ai_review: { ai_risk_hint: 'ALTO', confidence: 'media' },
      final_verdict: {
        risk_level: 'ALTO',
        source: 'deterministic_priority',
        reason: 'Patró crític conegut',
      },
      semantic_facts: { isInfiniteApproval: true },
      performance: { total_backend_ms: 125, ai_review_ms: 80 },
      evaluation: { scenario: 'A', repetition: 1, expected_risk: 'ALTO' },
    };

    const id = await database.saveAnalysisHistory(rawTx, analysis);
    const detail = await database.getAnalysisHistoryDetail(id);

    assert.equal(detail.risk_level, 'ALTO');
    assert.equal(detail.final_verdict.source, 'deterministic_priority');
    assert.equal(detail.ai_review.confidence, 'media');
    assert.equal(detail.known_address_signals.findings.length, 0);
    assert.equal(detail.local_memory_signals.findings[0], 'Context local');
    assert.equal(detail.semantic_facts.isInfiniteApproval, true);
    assert.equal(detail.performance.total_backend_ms, 125);
    assert.equal(detail.evaluation.scenario, 'A');
  } finally {
    await database.closeDB();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    delete process.env.WEB3_SECURITY_DB_PATH;
  }
});
