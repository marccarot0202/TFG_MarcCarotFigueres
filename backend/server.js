const express = require('express');
const cors = require('cors');

const {
  initDB,
  getDashboardStats,
  getRecentAnalysisHistory,
  getKnownAddresses,
  addKnownAddress,
  getDashboardMetrics,
  getAnalysisHistoryDetail,
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
    console.warn('⚠️ No s’ha pogut connectar amb Ollama:', error.message);
    return {
      status: 'error',
      message: 'No s’ha pogut connectar amb Ollama',
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
    health.database.status !== 'ok' || health.ollama.status !== 'ok';

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
    console.error('❌ Error obtenint les estadístiques:', error.message);

    res.status(500).json({
      success: false,
      error: 'Error obtenint les estadístiques',
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
    console.error('❌ Error obtenint les mètriques del tauler:', error.message);

    res.status(500).json({
      success: false,
      error: 'Error obtenint les mètriques del tauler',
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
    console.error("❌ Error obtenint l'historial:", error.message);

    res.status(500).json({
      success: false,
      error: "Error obtenint l'historial",
      details: error.message,
    });
  }
});

app.get('/analysis-history/:id', async (req, res) => {
  try {
    const detail = await getAnalysisHistoryDetail(req.params.id);

    if (!detail) {
      return res.status(404).json({
        success: false,
        error: 'No s’ha trobat l’anàlisi',
      });
    }

    res.json({
      success: true,
      detail,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error obtenint el detall de l'anàlisi:", error.message);

    res.status(500).json({
      success: false,
      error: "Error obtenint el detall de l'anàlisi",
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
    console.error('❌ Error obtenint les adreces conegudes:', error.message);

    res.status(500).json({
      success: false,
      error: 'Error obtenint les adreces conegudes',
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
        error: 'L’adreça Ethereum no és vàlida',
      });
    }

    const cleanAddress = address.trim().toLowerCase();
    const cleanLabel =
      typeof label === 'string' && label.trim()
        ? label.trim()
        : "Etiqueta manual de l'usuari";

    const cleanType = normalizeManualAddressType(type);

    await addKnownAddress(
      cleanAddress,
      cleanLabel,
      cleanType,
      'user_manual_report',
    );

    res.json({
      success: true,
      message: 'Adreça afegida correctament al conjunt de dades local',
      address: {
        address: cleanAddress,
        label: cleanLabel,
        type: cleanType,
        source: 'user_manual_report',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error afegint l'adreça manual:", error.message);

    res.status(500).json({
      success: false,
      error: "Error afegint l'adreça manual",
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

  const normalized = String(type || '')
    .trim()
    .toLowerCase();

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
        reason: analysis.final_verdict?.reason || 'Sense cap motiu addicional',
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
      analysis_id: analysis.analysis_id,
      performance: analysis.performance,
      evaluation: analysis.evaluation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error analitzant la transacció:', error.message);
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
    console.error('❌ Error inicialitzant el backend:', error.message);
    process.exit(1);
  }
}

bootstrap();
