const RISK_LABELS: Record<string, string> = {
  BAJO: 'Baix',
  MEDIO: 'Mitjà',
  ALTO: 'Alt',
  DESCONOCIDO: 'Desconegut',
  LOW: 'Baix',
  MEDIUM: 'Mitjà',
  HIGH: 'Alt',
  UNKNOWN: 'Desconegut',
};

const ACTION_LABELS: Record<string, string> = {
  ALLOW: 'Permetre',
  REVIEW: 'Revisar',
  BLOCK: 'Bloquejar',
};

const ADDRESS_TYPE_LABELS = new Map<string, string>([
  ['warning', 'Advertiment'],
  ['suspicious', 'Sospitosa'],
  ['scam', 'Estafa'],
  ['blacklist', 'Llista de bloqueig'],
  ['blacklisted', 'Llista de bloqueig'],
  ['trusted', 'De confiança'],
  ['known_protocol', 'Protocol conegut'],
  ['test_contract', 'Contracte de prova'],
  ['own_contract', 'Contracte propi'],
]);

const SOURCE_LABELS = new Map<string, string>([
  ['user_manual_report', 'Informe manual'],
  ['mew_ethereum_lists_darklist', 'Llista pública MEW'],
]);

export const getRiskLabel = (risk?: string) => {
  if (!risk) {
    return 'Desconegut';
  }

  return RISK_LABELS[risk.toUpperCase()] ?? risk;
};

export const getActionLabel = (action?: string) => {
  if (!action) {
    return 'Sense decisió';
  }

  return ACTION_LABELS[action.toUpperCase()] ?? action;
};

export const getAddressTypeLabel = (type?: string) => {
  if (!type) {
    return 'Sense tipus';
  }

  return ADDRESS_TYPE_LABELS.get(type.toLowerCase()) ?? type;
};

export const getSourceLabel = (source?: string) => {
  if (!source) {
    return 'Sense font';
  }

  return SOURCE_LABELS.get(source.toLowerCase()) ?? source;
};

export const getMetricLabel = (label?: string) => {
  if (!label) {
    return 'Desconegut';
  }

  return RISK_LABELS[label.toUpperCase()] ?? label;
};
