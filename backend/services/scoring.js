function scoreContext(tx, context) {
  let score = 0;
  const issues = [];

  if (context.knownAddress) {
    if (context.knownAddress.type === 'scam') {
      score += 80;
      issues.push(`Dirección etiquetada como scam por ${context.knownAddress.source}`);
    } else if (context.knownAddress.type === 'suspicious') {
      score += 50;
      issues.push(`Dirección sospechosa según ${context.knownAddress.source}`);
    }
  }

  if (tx.is_infinite_approve) {
    score += 70;
    issues.push('Approve infinito detectado');
  }

  if (tx.type === 'setApprovalForAll') {
    score += 70;
    issues.push('setApprovalForAll detectado: permiso total sobre NFTs/tokens');
  }

  if (context.contractCache) {
    if (context.contractCache.risk_level === 'ALTO') {
      score += 40;
      issues.push('Contrato previamente analizado como ALTO riesgo');
    } else if (context.contractCache.risk_level === 'MEDIO') {
      score += 20;
      issues.push('Contrato previamente analizado como riesgo MEDIO');
    }
  }

  if (context.etherscan && context.etherscan.fetched) {
    if (!context.etherscan.verified) {
      score += 25;
      issues.push('Contrato no verificado en Etherscan');
    }

    if (context.etherscan.sourceCode) {
      const source = context.etherscan.sourceCode.toLowerCase();

      if (source.includes('delegatecall')) {
        score += 30;
        issues.push('Uso de delegatecall detectado');
      }

      if (source.includes('selfdestruct')) {
        score += 35;
        issues.push('Uso de selfdestruct detectado');
      }

      if (source.includes('tx.origin')) {
        score += 20;
        issues.push('Uso de tx.origin detectado');
      }
    }
  }

  if (context.similarTransactions?.length > 0) {
    const highRiskCount = context.similarTransactions
      .filter((tx) => tx.risk_level === 'ALTO')
      .reduce((acc, tx) => acc + tx.count, 0);

    if (highRiskCount > 0) {
      score += 15;
      issues.push('Existen transacciones similares con riesgo ALTO en el historial');
    }
  }

  let risk_level = 'BAJO';
  if (score >= 70) risk_level = 'ALTO';
  else if (score >= 35) risk_level = 'MEDIO';

  return {
    risk_score: Math.min(score, 100),
    risk_level,
    issues,
  };
}

module.exports = { scoreContext };