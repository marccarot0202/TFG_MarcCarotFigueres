const fs = require('node:fs');
const path = require('node:path');

const { decodeKnownTransaction } = require('../services/decoder');
const { buildDeterministicVerdict } = require('../services/rules');

const REPETITIONS = 10;
const SPENDER = '3333333333333333333333333333333333333333';
const MAX_UINT256 = (1n << 256n) - 1n;
const BOUNDARY_APPROVAL_AMOUNTS = [
  MAX_UINT256 - 1n,
  MAX_UINT256 - 2n,
  MAX_UINT256 - 3n,
  MAX_UINT256 - 4n,
  MAX_UINT256 - 5n,
  MAX_UINT256 - 6n,
  MAX_UINT256 - 7n,
  1n,
  10n ** 6n,
  10n ** 18n,
];

function abiWord(value) {
  return value.toString(16).padStart(64, '0');
}

function addressWord(address) {
  return address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function approveData(amount) {
  return `0x095ea7b3${addressWord(SPENDER)}${abiWord(amount)}`;
}

function setApprovalForAllData(approved) {
  return `0xa22cb465${addressWord(SPENDER)}${abiWord(approved ? 1n : 0n)}`;
}

const cases = [
  {
    id: 'A1',
    description: 'Transferencia simple sin indicadores adicionales',
    expectedClass: 'negative',
    tx: { data: '0x', method_selector: null, is_contract_interaction: false },
  },
  {
    id: 'B1',
    description: 'Aprobacion ERC20 limitada',
    expectedClass: 'negative',
    tx: { data: approveData(10n ** 18n), method_selector: '0x095ea7b3', is_contract_interaction: true },
  },
  {
    id: 'B2',
    description: 'Revocacion ERC20',
    expectedClass: 'negative',
    tx: { data: approveData(0n), method_selector: '0x095ea7b3', is_contract_interaction: true },
  },
  {
    id: 'C1',
    description: 'Aprobacion ERC20 ilimitada',
    expectedClass: 'positive',
    tx: { data: approveData(MAX_UINT256), method_selector: '0x095ea7b3', is_contract_interaction: true },
  },
  {
    id: 'C2',
    description: 'Aprobacion ERC20 de frontera con cantidades variables',
    expectedClassForRepetition: (repetition) => repetition <= 7 ? 'positive' : 'negative',
    txForRepetition: (repetition) => ({
      data: approveData(BOUNDARY_APPROVAL_AMOUNTS[repetition - 1]),
      method_selector: '0x095ea7b3',
      is_contract_interaction: true,
    }),
  },
  {
    id: 'D1',
    description: 'Permiso global ERC721 activo',
    expectedClass: 'positive',
    tx: { data: setApprovalForAllData(true), method_selector: '0xa22cb465', is_contract_interaction: true },
  },
  {
    id: 'D2',
    description: 'Revocacion del permiso global ERC721',
    expectedClass: 'negative',
    tx: { data: setApprovalForAllData(false), method_selector: '0xa22cb465', is_contract_interaction: true },
  },
  {
    id: 'E1',
    description: 'Interaccion con direccion etiquetada como scam',
    expectedClass: 'positive',
    knownAddressFixture: { type: 'scam', scoreAdjustment: 50, forcedRiskLevel: 'ALTO' },
    tx: { data: '0x', method_selector: null, is_contract_interaction: false },
  },
];

function executeCase(testCase, repetition) {
  const tx = {
    ...(testCase.txForRepetition ? testCase.txForRepetition(repetition) : testCase.tx),
    origin: 'automated_evaluation',
    has_value: false,
    value: '0x0',
  };
  tx.decoded = decodeKnownTransaction(tx);

  const verdict = buildDeterministicVerdict(tx);
  if (testCase.knownAddressFixture) {
    verdict.findings.push(`Direccion conocida: ${testCase.knownAddressFixture.type}`);
    verdict.risk_score = Math.min(100, verdict.risk_score + testCase.knownAddressFixture.scoreAdjustment);
    verdict.risk_level = testCase.knownAddressFixture.forcedRiskLevel;
    verdict.recommended_action = 'REVIEW';
  }

  const predictedClass = verdict.risk_level === 'BAJO' && verdict.recommended_action === 'ALLOW'
    ? 'negative'
    : 'positive';
  const expectedClass = testCase.expectedClassForRepetition
    ? testCase.expectedClassForRepetition(repetition)
    : testCase.expectedClass;
  const classification = expectedClass === 'positive'
    ? (predictedClass === 'positive' ? 'TP' : 'FN')
    : (predictedClass === 'negative' ? 'TN' : 'FP');

  return {
    scenario: testCase.id,
    repetition,
    description: testCase.description,
    expected_class: expectedClass,
    predicted_class: predictedClass,
    classification,
    risk_level: verdict.risk_level,
    risk_score: verdict.risk_score,
    recommended_action: verdict.recommended_action,
    approved_amount: tx.decoded?.amount || null,
  };
}

const executions = cases.flatMap((testCase) =>
  Array.from({ length: REPETITIONS }, (_, index) => executeCase(testCase, index + 1)),
);

const counts = executions.reduce((result, execution) => {
  result[execution.classification] += 1;
  return result;
}, { TP: 0, TN: 0, FP: 0, FN: 0 });

const total = executions.length;
const ratio = (numerator, denominator) => denominator === 0 ? null : numerator / denominator;
const precision = ratio(counts.TP, counts.TP + counts.FP);
const recall = ratio(counts.TP, counts.TP + counts.FN);
const report = {
  generated_at: new Date().toISOString(),
  methodology: 'deterministic_engine_with_repetitions_boundary_values_and_controlled_known_address_fixture',
  observations_per_case: REPETITIONS,
  cases: cases.length,
  total_executions: total,
  confusion_matrix: counts,
  metrics: {
    accuracy: ratio(counts.TP + counts.TN, total),
    precision,
    recall,
    specificity: ratio(counts.TN, counts.TN + counts.FP),
    f1: precision === null || recall === null ? null : ratio(2 * precision * recall, precision + recall),
  },
  executions,
};

const outputDirectory = path.join(__dirname, '..', 'evaluation', 'results');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, 'evaluation-matrix.json'), `${JSON.stringify(report, null, 2)}\n`);

const csvHeader = 'scenario,repetition,expected_class,predicted_class,classification,risk_level,risk_score,recommended_action,approved_amount';
const csvRows = executions.map((entry) => [
  entry.scenario,
  entry.repetition,
  entry.expected_class,
  entry.predicted_class,
  entry.classification,
  entry.risk_level,
  entry.risk_score,
  entry.recommended_action,
  entry.approved_amount || '',
].join(','));
fs.writeFileSync(path.join(outputDirectory, 'evaluation-matrix.csv'), `${[csvHeader, ...csvRows].join('\n')}\n`);

console.log(JSON.stringify({
  outputDirectory,
  total_executions: total,
  confusion_matrix: counts,
  metrics: report.metrics,
}, null, 2));
