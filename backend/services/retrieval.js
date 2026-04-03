const {
  lookupAddress,
  getContractCache,
  findSimilarTransactions,
  saveContractAnalysis,
} = require('./database');
const { fetchContractInfo } = require('./etherscan');

async function retrieveContext(tx) {
  const [knownAddress, contractCache, similarTransactions] = await Promise.all([
    tx.to ? lookupAddress(tx.to) : Promise.resolve(null),
    tx.to ? getContractCache(tx.to) : Promise.resolve(null),
    tx.to && tx.function_selector
      ? findSimilarTransactions(tx.to, tx.function_selector)
      : Promise.resolve([]),
  ]);

  let etherscan = null;

  if (!contractCache && tx.to && tx.type !== 'eth_transfer') {
    etherscan = await fetchContractInfo(tx.to, tx.chainId);

    if (etherscan.fetched) {
      await saveContractAnalysis(tx.to, {
        name: etherscan.name,
        verified: etherscan.verified,
        source_code: etherscan.sourceCode,
        abi: etherscan.abi,
        risk_level: etherscan.verified ? 'BAJO' : 'MEDIO',
        risk_score: etherscan.verified ? 10 : 35,
        issues: etherscan.verified ? [] : ['Contrato no verificado en Etherscan'],
        ai_summary: etherscan.verified
          ? 'Contrato verificado obtenido desde Etherscan'
          : 'Contrato no verificado o sin source code público',
      });
    }
  }

  return {
    knownAddress,
    contractCache,
    similarTransactions,
    etherscan,
  };
}

module.exports = { retrieveContext };