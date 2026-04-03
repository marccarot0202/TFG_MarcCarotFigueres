const axios = require('axios');

async function testBackend() {
  try {
    console.log('🧪 Probando backend con Ollama...\n');
    
    const response = await axios.post('http://localhost:3000/analyze', {
      type: 'approve',
      contract: '0x1234...',
      amount: 'unlimited'
    });
    
    console.log('✅ Respuesta exitosa:\n');
    console.log('🔴 Riesgo:', response.data.risk);
    console.log('\n📝 Explicación:');
    console.log(response.data.explanation);
    console.log('\n⏰ Timestamp:', response.data.timestamp);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Respuesta:', error.response.data);
    }
  }
}

testBackend();