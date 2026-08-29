const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434/api/generate';

async function askOllama(prompt, model = 'llama3.2') {
  try {
    console.log('📤 Enviant el prompt a Ollama...');
    console.log('📏 Longitud del prompt:', prompt.length);

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

    console.log("📥 S'ha rebut la resposta en brut d'Ollama");

    return response.data.response;
  } catch (error) {
    console.error('Error cridant Ollama:', error.message);

    if (error.response) {
      console.error("Estat d'Ollama:", error.response.status);
      console.error("Dades d'Ollama:", error.response.data);
    }

    throw error;
  }
}

module.exports = { askOllama };
