function buildDeterministicVerdict(tx) {
  const findings = [];
  let risk_level = 'BAJO';
  let risk_score = 10;
  let recommended_action = 'ALLOW';

  if (tx.decoded?.method === 'approve') {
    findings.push('Se ha detectado una aprobación de tokens');
    findings.push(`Dirección autorizada: ${tx.decoded.spender}`);

    if (tx.decoded.is_infinite_approval) {
      findings.push('Cantidad aprobada: ilimitada');
      findings.push('La aprobación es ilimitada');
      findings.push('La dirección autorizada podría mover todos los tokens permitidos sin pedir permiso de nuevo');
      risk_level = 'ALTO';
      risk_score = 90;
      recommended_action = 'REVIEW';
    } else {
      findings.push(`Cantidad aprobada: ${tx.decoded.amount}`);
      findings.push('La aprobación no es ilimitada');

      if (tx.decoded.amount === '0') {
        findings.push('Esto parece una revocación de permiso');
        risk_level = 'BAJO';
        risk_score = 5;
        recommended_action = 'ALLOW';
      } else {
        findings.push('Se concede un permiso limitado');
        risk_level = 'BAJO';
        risk_score = 20;
        recommended_action = 'ALLOW';
      }
    }
  } else if (tx.decoded?.method === 'setApprovalForAll') {
    findings.push('Se ha detectado un permiso global sobre activos tipo NFT o similares');
    findings.push(`Operador afectado: ${tx.decoded.operator}`);

    if (tx.decoded.approved) {
      findings.push('Se activa un permiso global');
      findings.push('El operador podrá gestionar todos los activos cubiertos por este permiso');
      risk_level = 'ALTO';
      risk_score = 95;
      recommended_action = 'REVIEW';
    } else {
      findings.push('Se revoca el permiso global');
      risk_level = 'BAJO';
      risk_score = 5;
      recommended_action = 'ALLOW';
    }
  } else if (tx.is_contract_interaction) {
    findings.push('La transacción interactúa con un contrato inteligente');

    if (tx.method_selector) {
      findings.push(`Selector detectado: ${tx.method_selector}`);
      findings.push('La función exacta todavía no está soportada por el decodificador actual');
    }

    risk_level = 'MEDIO';
    risk_score = 50;
    recommended_action = 'REVIEW';
  } else {
    findings.push('Parece una transferencia simple');
    risk_level = 'BAJO';
    risk_score = 10;
    recommended_action = 'ALLOW';
  }

  if (tx.has_value) {
    findings.push(`También envía ETH: ${tx.value}`);
  }

  if (tx.origin) {
    findings.push(`Origen de la solicitud: ${tx.origin}`);
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