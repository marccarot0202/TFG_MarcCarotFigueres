const express = require('express');
const cors = require('cors');

const {
  initDB,
  getDashboardStats,
  getRecentAnalysisHistory,
  getKnownAddresses,
  addKnownAddress,
  getDashboardMetrics,
} = require('./services/database');

const { analyzeTransaction } = require('./services/analyzer');
let databaseReady = false;

const app = express();
app.use(cors());
app.use(express.json());

async function checkOllama() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        status: 'error',
        message: `Ollama ha contestat amb estat ${response.status}`,
      };
    }

    return {
      status: 'ok',
      message: 'Ollama disponible',
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message || 'No ha estat possible connectar amb Ollama',
    };
  }
}

app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionant' });
});

app.get('/health', async (req, res) => {
  const ollamaStatus = await checkOllama();

  const health = {
    backend: {
      status: 'ok',
      message: 'Backend funcionant',
    },
    database: {
      status: databaseReady ? 'ok' : 'error',
      message: databaseReady
        ? 'Base de dades inicialitzada'
        : 'Base de dades no inicialitzada',
    },
    ollama: ollamaStatus,
    timestamp: new Date().toISOString(),
  };

  const hasError =
    health.database.status !== 'ok' ||
    health.ollama.status !== 'ok';

  res.status(hasError ? 503 : 200).json(health);
});

app.get('/stats', async (req, res) => {
  try {
    const stats = await getDashboardStats();

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error obtenint estadísticas:', error.message);

    res.status(500).json({
      success: false,
      error: 'Error obtenint estadísticas',
      details: error.message,
    });
  }
});

app.get('/dashboard-metrics', async (req, res) => {
  try {
    const metrics = await getDashboardMetrics();

    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error obteniendo métricas del dashboard:', error.message);

    res.status(500).json({
      success: false,
      error: 'Error obteniendo métricas del dashboard',
      details: error.message,
    });
  }
});

app.get('/analysis-history', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const rows = await getRecentAnalysisHistory(limit);

    res.json({
      success: true,
      history: rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error obteniendo histórico:', error.message);

    res.status(500).json({
      success: false,
      error: 'Error obteniendo histórico',
      details: error.message,
    });
  }
});

app.get('/known-addresses', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const type = req.query.type || null;
    const search = req.query.search || null;

    const addresses = await getKnownAddresses({
      limit,
      type,
      search,
    });

    res.json({
      success: true,
      addresses,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error obteniendo direcciones conocidas:', error.message);

    res.status(500).json({
      success: false,
      error: 'Error obteniendo direcciones conocidas',
      details: error.message,
    });
  }
});

app.post('/known-addresses/manual', async (req, res) => {
  try {
    const { address, label, type } = req.body;

    if (!isValidEthereumAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Dirección Ethereum no válida',
      });
    }

    const cleanAddress = address.trim().toLowerCase();
    const cleanLabel =
      typeof label === 'string' && label.trim()
        ? label.trim()
        : 'Etiqueta manual del usuario';

    const cleanType = normalizeManualAddressType(type);

    await addKnownAddress(
      cleanAddress,
      cleanLabel,
      cleanType,
      'user_manual_report',
    );

    res.json({
      success: true,
      message: 'Dirección añadida correctamente al dataset local',
      address: {
        address: cleanAddress,
        label: cleanLabel,
        type: cleanType,
        source: 'user_manual_report',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error añadiendo dirección manual:', error.message);

    res.status(500).json({
      success: false,
      error: 'Error añadiendo dirección manual',
      details: error.message,
    });
  }
});

function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(address || '').trim());
}

function normalizeManualAddressType(type) {
  const allowedTypes = [
    'warning',
    'suspicious',
    'scam',
    'blacklisted',
    'trusted',
    'test_contract',
    'own_contract',
  ];

  const normalized = String(type || '').trim().toLowerCase();

  if (allowedTypes.includes(normalized)) {
    return normalized;
  }

  return 'warning';
}

app.post('/analyze', async (req, res) => {
  try {
    const txData = req.body;

    console.log('📥 Analitzant:', txData);

    const analysis = await analyzeTransaction(txData);

    res.json({
      success: true,

      risk: analysis.final_verdict?.risk_level || analysis.risk_level,
      risk_score: analysis.risk_score,
      issues: analysis.issues,

      verdict: {
        risk: analysis.final_verdict?.risk_level || analysis.risk_level,
        risk_score: analysis.risk_score,
        recommended_action: analysis.recommended_action,
        source: analysis.final_verdict?.source || 'deterministic_base',
        reason: analysis.final_verdict?.reason || 'Sin motivo adicional',
      },

      findings: analysis.findings,
      explanation: analysis.explanation,
      context_summary: analysis.context_summary,
      normalized_tx: analysis.normalized_tx,
      decoded: analysis.decoded,
      deterministic_verdict: analysis.deterministic_verdict,
      local_memory_signals: analysis.local_memory_signals,
      ai_review: analysis.ai_review,
      final_verdict: analysis.final_verdict,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error analitzant la transacció',
      details: error.message,
    });
  }
});

const PORT = 3000;

async function bootstrap() {
  try {
    await initDB();
    databaseReady = true;

    app.listen(PORT, () => {
      console.log(`🚀 Backend funcionant en http://localhost:${PORT}`);
      console.log(`🤖 Ollama esperat en http://localhost:11434`);
    });
  } catch (error) {
    console.error('❌ Error inicialitzant  backend:', error.message);
    process.exit(1);
  }
}

bootstrap();