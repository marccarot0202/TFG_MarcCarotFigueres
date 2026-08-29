function buildDeterministicVerdict(tx) {
  const findings = [];
  let risk_level = 'BAJO';
  let risk_score = 10;
  let recommended_action = 'ALLOW';

  if (tx.decoded?.method === 'approve') {
    findings.push("S'ha detectat una aprovació de tokens");
    findings.push(`Adreça autoritzada: ${tx.decoded.spender}`);

    if (tx.decoded.is_infinite_approval) {
      findings.push('Quantitat aprovada: il·limitada');
      findings.push("L'aprovació és il·limitada");
      findings.push(
        "L'adreça autoritzada podria moure tots els tokens permesos sense tornar a demanar permís",
      );
      risk_level = 'ALTO';
      risk_score = 90;
      recommended_action = 'REVIEW';
    } else {
      findings.push(`Quantitat aprovada: ${tx.decoded.amount}`);
      findings.push("L'aprovació no és il·limitada");

      if (tx.decoded.amount === '0') {
        findings.push('Això sembla una revocació de permís');
        risk_level = 'BAJO';
        risk_score = 5;
        recommended_action = 'ALLOW';
      } else {
        findings.push('Es concedeix un permís limitat');
        risk_level = 'BAJO';
        risk_score = 20;
        recommended_action = 'ALLOW';
      }
    }
  } else if (tx.decoded?.method === 'setApprovalForAll') {
    findings.push(
      "S'ha detectat un permís global sobre actius de tipus NFT o similars",
    );
    findings.push(`Operador afectat: ${tx.decoded.operator}`);

    if (tx.decoded.approved) {
      findings.push("S'activa un permís global");
      findings.push(
        "L'operador podrà gestionar tots els actius coberts per aquest permís",
      );
      risk_level = 'ALTO';
      risk_score = 95;
      recommended_action = 'REVIEW';
    } else {
      findings.push('Es revoca el permís global');
      risk_level = 'BAJO';
      risk_score = 5;
      recommended_action = 'ALLOW';
    }
  } else if (tx.is_contract_interaction) {
    findings.push('La transacció interactua amb un contracte intel·ligent');

    if (tx.method_selector) {
      findings.push(`Selector detectat: ${tx.method_selector}`);
      findings.push(
        'La funció exacta encara no és compatible amb el descodificador actual',
      );
    }

    risk_level = 'MEDIO';
    risk_score = 50;
    recommended_action = 'REVIEW';
  } else {
    findings.push('Sembla una transferència simple');
    risk_level = 'BAJO';
    risk_score = 10;
    recommended_action = 'ALLOW';
  }

  if (tx.has_value) {
    findings.push(`També envia ETH: ${tx.value}`);
  }

  if (tx.origin) {
    findings.push(`Origen de la sol·licitud: ${tx.origin}`);
  }

  return {
    findings,
    risk_level,
    risk_score,
    recommended_action,
  };
}

module.exports = {
  buildDeterministicVerdict,
};
