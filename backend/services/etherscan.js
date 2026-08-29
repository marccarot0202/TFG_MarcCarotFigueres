const axios = require('axios');

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const ETHERSCAN_URL = 'https://api.etherscan.io/v2/api';

async function fetchContractInfo(address, chainId = '11155111') {
  if (!ETHERSCAN_API_KEY || !address) {
    return {
      fetched: false,
      verified: false,
      name: null,
      abi: null,
      sourceCode: null,
      reason: "No s'ha configurat la clau de l'API o falta l'adreça",
    };
  }

  try {
    const [sourceResp, abiResp] = await Promise.allSettled([
      axios.get(ETHERSCAN_URL, {
        timeout: 1200,
        params: {
          chainid: chainId,
          module: 'contract',
          action: 'getsourcecode',
          address,
          apikey: ETHERSCAN_API_KEY,
        },
      }),
      axios.get(ETHERSCAN_URL, {
        timeout: 1200,
        params: {
          chainid: chainId,
          module: 'contract',
          action: 'getabi',
          address,
          apikey: ETHERSCAN_API_KEY,
        },
      }),
    ]);

    let sourceData = null;
    let abiData = null;

    if (sourceResp.status === 'fulfilled') {
      const result = sourceResp.value.data?.result?.[0];
      if (result) sourceData = result;
    }

    if (abiResp.status === 'fulfilled') {
      abiData = abiResp.value.data?.result || null;
    }

    const verified = !!(sourceData && sourceData.SourceCode);

    return {
      fetched: true,
      verified,
      name: sourceData?.ContractName || null,
      sourceCode: sourceData?.SourceCode || null,
      abi: abiData,
      compilerVersion: sourceData?.CompilerVersion || null,
      proxy: sourceData?.Proxy === '1',
      implementation: sourceData?.Implementation || null,
    };
  } catch (error) {
    return {
      fetched: false,
      verified: false,
      name: null,
      abi: null,
      sourceCode: null,
      reason: error.message,
    };
  }
}

module.exports = { fetchContractInfo };
