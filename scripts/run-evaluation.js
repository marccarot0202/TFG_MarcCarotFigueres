const fs = require('fs');
const path = require('path');
const os = require('os');

const API_URL = process.env.EVALUATION_API_URL || 'http://localhost:3000';
const repetitions = Number(process.argv[2] || 1);
const SPENDER = `0x${'3'.repeat(40)}`;
const TARGET = `0x${'2'.repeat(40)}`;
const SCAM_TARGET = `0x${'e'.repeat(40)}`;
const FROM = `0x${'1'.repeat(40)}`;
const MAX_UINT256 = 'f'.repeat(64);

function word(value) {
  return value.replace(/^0x/, '').padStart(64, '0');
}

function approveData(spender, amountHex) {
  return `0x095ea7b3${word(spender)}${word(amountHex)}`;
}

function approvalForAllData(operator, approved) {
  return `0xa22cb465${word(operator)}${word(approved ? '1' : '0')}`;
}

const baseTransaction = {
  chainId: '0xaa36a7',
  from: FROM,
  to: TARGET,
  value: '0x0',
  origin: 'evaluation_runner',
};

const cases = [
  {
    id: 'A1',
    scenario: 'A',
    operation: 'Simple transaction without risk indicators',
    expectedClass: 'negative',
    tx: { ...baseTransaction, data: '0x' },
  },
  {
    id: 'B1',
    scenario: 'B',
    operation: 'Limited ERC20 approval',
    expectedClass: 'negative',
    tx: { ...baseTransaction, data: approveData(SPENDER, '64') },
  },
  {
    id: 'B2',
    scenario: 'B',
    operation: 'ERC20 approval revocation',
    expectedClass: 'negative',
    tx: { ...baseTransaction, data: approveData(SPENDER, '0') },
  },
  {
    id: 'C1',
    scenario: 'C',
    operation: 'Unlimited ERC20 approval',
    expectedClass: 'positive',
    tx: { ...baseTransaction, data: approveData(SPENDER, MAX_UINT256) },
  },
  {
    id: 'D1',
    scenario: 'D',
    operation: 'Enable global ERC721 approval',
    expectedClass: 'positive',
    tx: { ...baseTransaction, data: approvalForAllData(SPENDER, true) },
  },
  {
    id: 'D2',
    scenario: 'D',
    operation: 'Revoke global ERC721 approval',
    expectedClass: 'negative',
    tx: { ...baseTransaction, data: approvalForAllData(SPENDER, false) },
  },
  {
    id: 'E1',
    scenario: 'E',
    operation: 'Interaction with a controlled scam-labelled address',
    expectedClass: 'positive',
    tx: { ...baseTransaction, to: SCAM_TARGET, data: '0x' },
  },
];

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function predictedClass(response) {
  const risk = response.final_verdict?.risk_level || response.risk;
  const action = response.verdict?.recommended_action;
  return risk === 'MEDIO' || risk === 'ALTO' || action === 'REVIEW'
    ? 'positive'
    : 'negative';
}

function summarize(observations) {
  const matrix = { true_positive: 0, false_positive: 0, true_negative: 0, false_negative: 0 };
  for (const item of observations.filter((entry) => !entry.error)) {
    if (item.expected_class === 'positive' && item.predicted_class === 'positive') matrix.true_positive += 1;
    if (item.expected_class === 'negative' && item.predicted_class === 'positive') matrix.false_positive += 1;
    if (item.expected_class === 'negative' && item.predicted_class === 'negative') matrix.true_negative += 1;
    if (item.expected_class === 'positive' && item.predicted_class === 'negative') matrix.false_negative += 1;
  }

  const { true_positive: tp, false_positive: fp, true_negative: tn, false_negative: fn } = matrix;
  const ratio = (numerator, denominator) => denominator ? numerator / denominator : null;
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  const durations = observations
    .map((item) => item.response?.performance?.total_backend_ms)
    .filter(Number.isFinite);

  return {
    matrix,
    metrics: {
      accuracy: ratio(tp + tn, tp + tn + fp + fn),
      precision,
      recall,
      specificity: ratio(tn, tn + fp),
      f1: precision !== null && recall !== null && precision + recall
        ? (2 * precision * recall) / (precision + recall)
        : null,
    },
    timing_ms: durations.length ? {
      minimum: Math.min(...durations),
      maximum: Math.max(...durations),
      mean: durations.reduce((sum, value) => sum + value, 0) / durations.length,
    } : null,
  };
}

async function main() {
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new Error('Repetitions must be a positive integer');
  }

  await request('/known-addresses/manual', {
    method: 'POST',
    body: JSON.stringify({
      address: SCAM_TARGET,
      label: 'Controlled evaluation address E1',
      type: 'scam',
    }),
  });

  const observations = [];
  for (const testCase of cases) {
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      const evaluation = {
        scenario: testCase.scenario,
        case_id: testCase.id,
        repetition,
        expected_class: testCase.expectedClass,
        operation: testCase.operation,
        decision: 'not_submitted',
      };
      process.stdout.write(`Running ${testCase.id} repetition ${repetition}/${repetitions}... `);
      try {
        const response = await request('/analyze', {
          method: 'POST',
          body: JSON.stringify({ ...testCase.tx, evaluation }),
        });
        const observation = {
          ...evaluation,
          expected_class: testCase.expectedClass,
          predicted_class: predictedClass(response),
          analysis_id: response.analysis_id,
          response,
        };
        observations.push(observation);
        console.log(`${observation.predicted_class}, analysis #${response.analysis_id}`);
      } catch (error) {
        observations.push({ ...evaluation, expected_class: testCase.expectedClass, error: error.message });
        console.log(`ERROR: ${error.message}`);
      }
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    protocol: { repetitions, api_url: API_URL, cases: cases.map(({ tx, ...item }) => item) },
    environment: {
      platform: `${os.type()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model || null,
      cpu_cores: os.cpus().length,
      ram_bytes: os.totalmem(),
      node: process.version,
    },
    summary: summarize(observations),
    observations,
  };

  const outputDirectory = path.join(__dirname, '..', 'evaluation', 'results');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDirectory, `evaluation-${repetitions}x-${suffix}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report written to ${outputPath}`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
