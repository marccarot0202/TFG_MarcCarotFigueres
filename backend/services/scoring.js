function scoreContext(tx, context) {
  let score = 0;
  const issues = [];

  if (context.knownAddress) {
    if (context.knownAddress.type === 'scam') {
      score += 80;
      issues.push(
        `Adreça etiquetada com a scam per ${context.knownAddress.source}`,
      );
    } else if (context.knownAddress.type === 'suspicious') {
      score += 50;
      issues.push(`Adreça sospitosa segons ${context.knownAddress.source}`);
    }
  }

  if (tx.is_infinite_approve) {
    score += 70;
    issues.push('Approve il·limitat detectat');
  }

  if (tx.type === 'setApprovalForAll') {
    score += 70;
    issues.push('setApprovalForAll detectat: permís total sobre NFT o tokens');
  }

  if (context.contractCache) {
    if (context.contractCache.risk_level === 'ALTO') {
      score += 40;
      issues.push('Contracte analitzat prèviament com de risc ALT');
    } else if (context.contractCache.risk_level === 'MEDIO') {
      score += 20;
      issues.push('Contracte analitzat prèviament com de risc MITJÀ');
    }
  }

  if (context.etherscan && context.etherscan.fetched) {
    if (!context.etherscan.verified) {
      score += 25;
      issues.push('Contracte no verificat a Etherscan');
    }

    if (context.etherscan.sourceCode) {
      const source = context.etherscan.sourceCode.toLowerCase();

      if (source.includes('delegatecall')) {
        score += 30;
        issues.push("S'ha detectat l'ús de delegatecall");
      }

      if (source.includes('selfdestruct')) {
        score += 35;
        issues.push("S'ha detectat l'ús de selfdestruct");
      }

      if (source.includes('tx.origin')) {
        score += 20;
        issues.push("S'ha detectat l'ús de tx.origin");
      }
    }
  }

  if (context.similarTransactions?.length > 0) {
    const highRiskCount = context.similarTransactions
      .filter((tx) => tx.risk_level === 'ALTO')
      .reduce((acc, tx) => acc + tx.count, 0);

    if (highRiskCount > 0) {
      score += 15;
      issues.push("Hi ha transaccions similars amb risc ALT a l'historial");
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
