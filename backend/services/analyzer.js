const { askOllama } = require('./ollama');

async function explainTransaction(txData) {
  // Detectar tipo de transacción
  let txType = 'transferencia simple';
  let context = '';
  
  if (txData.data && txData.data !== '0x') {
    txType = 'interacción con smart contract';
    context = 'Esto ejecutará código en un contrato inteligente.';
  }
  
  if (txData.type === 'approve') {
    txType = 'aprobación de tokens';
    context = 'Estás dando permiso para que un contrato mueva tus tokens.';
  }
  
  const valueInEth = txData.value !== '0' ? 'Envía ETH' : 'No envía ETH';

  const prompt = `
Eres un asistente de seguridad para criptomonedas.
Explica EN ESPAÑOL y de forma MUY SIMPLE qué hace esta transacción.

CONTEXTO:
- Tipo: ${txType}
- ${context}
- Desde: ${txData.from || 'usuario'}
- Hacia: ${txData.to || 'contrato desconocido'}
- ${valueInEth}
- Origen: ${txData.origin || 'DApp desconocida'}

INSTRUCCIONES:
1. Explica en 2-3 frases cortas y simples
2. Habla como si le explicaras a alguien que NO sabe de cripto
3. NO uses palabras técnicas como "0x", "wei", "gas", "ABI"
4. Si hay algo sospechoso, menciónalo claramente

Explicación:
  `.trim();

  const explanation = await askOllama(prompt);
  return explanation;
}

async function assessRisk(txData) {
  const prompt = `
Eres un experto en seguridad Web3.
Analiza esta transacción y responde SOLO con UNA PALABRA: BAJO, MEDIO o ALTO

DATOS:
- Tipo: ${txData.type || 'transaction'}
- Hacia: ${txData.to}
- Valor: ${txData.value}
- Data: ${txData.data}
- Origen: ${txData.origin || 'desconocido'}

CRITERIOS:
- ALTO: Contratos desconocidos, cantidades grandes, permisos ilimitados
- MEDIO: Contratos conocidos pero con riesgo, cantidades moderadas
- BAJO: Transferencias simples, cantidades pequeñas, contratos verificados

Responde SOLO con: BAJO, MEDIO o ALTO
Riesgo:
  `.trim();

  const risk = await askOllama(prompt);
  return risk.trim().toUpperCase();
}

module.exports = { explainTransaction, assessRisk };