const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434/api/generate';

async function askOllama(prompt, model = 'llama3.2') {
  try {
    const response = await axios.post(
      OLLAMA_URL,
      {
        model,
        prompt,
        stream: false,
      },
      {
        timeout: 0,
      },
    );

    return response.data.response;
  } catch (error) {
    console.error('Error llamando a Ollama:', error.message);
    throw error;
  }
}

function normalizeRisk(risk) {
  if (risk.includes('ALTO')) return 'ALTO';
  if (risk.includes('MEDIO')) return 'MEDIO';
  if (risk.includes('BAJO')) return 'BAJO';
  return 'DESCONOCIDO';
}


module.exports = { askOllama };