const axios = require('axios');

async function testBackend() {
  try {
    console.log('🧪 Provant el backend amb Ollama...\n');

    const response = await axios.post('http://localhost:3000/analyze', {
      type: 'approve',
      contract: '0x1234...',
      amount: 'unlimited',
    });

    console.log('✅ Resposta correcta:\n');
    console.log('🔴 Risc:', response.data.risk);
    console.log('\n📝 Explicació:');
    console.log(response.data.explanation);
    console.log('\n⏰ Marca temporal:', response.data.timestamp);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Resposta:', error.response.data);
    }
  }
}

testBackend();
