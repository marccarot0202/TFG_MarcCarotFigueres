const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434/api/generate';

async function askOllama(prompt, model = 'llama3.2') {
  try {
    console.log('📤 Enviando prompt a Ollama...');
    console.log('📏 Longitud prompt:', prompt.length);

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

    console.log('📥 Respuesta cruda de Ollama recibida');

    return response.data.response;
  } catch (error) {
    console.error('Error llamando a Ollama:', error.message);

    if (error.response) {
      console.error('Status Ollama:', error.response.status);
      console.error('Data Ollama:', error.response.data);
    }

    throw error;
  }
}

module.exports = { askOllama };