const express = require('express');
const cors = require('cors');
const { initDB } = require('./services/database');
const { analyzeTransaction } = require('./services/analyzer');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionando' });
});

app.post('/analyze', async (req, res) => {
  try {
    const txData = req.body;

    console.log('📥 Analizando:', txData);

    const analysis = await analyzeTransaction(txData);

    res.json({
      success: true,
      risk: analysis.risk_level,
      risk_score: analysis.risk_score,
      issues: analysis.issues,
      explanation: analysis.explanation,
      context_summary: analysis.context_summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error analizando la transacción',
      details: error.message,
    });
  }
});

const PORT = 3000;

async function bootstrap() {
  try {
    await initDB();

    app.listen(PORT, () => {
      console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
      console.log(`🤖 Ollama esperado en http://localhost:11434`);
    });
  } catch (error) {
    console.error('❌ Error inicializando backend:', error.message);
    process.exit(1);
  }
}

bootstrap();