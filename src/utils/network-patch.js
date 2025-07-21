// Network patch for Base Sepolia
module.exports = function patchConfig(config) {
  // Update network configuration
  const baseSepolia = {
    name: 'base-sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  };

  // Update contract addresses for Base Sepolia
  const contracts = {
    virtualContract: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a',
    plnToken: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    pollenDAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
    leagues: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a',
    vePLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995'
  };

  // Apply patches
  return {
    ...config,
    network: baseSepolia,
    contracts: {
      ...config.contracts,
      ...contracts
    },
    development: {
      ...config.development,
      skipNetworkValidation: true
    }
  };
};
