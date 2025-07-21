/**
 * Multi-Bot Configuration for Base Sepolia
 * Individual bot configurations with provided private keys
 */

const BOT_CONFIGS = {
  1: {
    name: 'Conservative Bot',
    privateKey: 'd74ae2c1a798042c9bbf56f15d2649df6d114e763f9444e2cddcde050900f1d0',
    address: '0x561529036AB886c1FD3D112360383D79fBA9E71c',
    strategy: 'conservative',
    risk: 'low',
    maxAllocation: 15,
    tradingPairs: ['PLN/ETH', 'PLN/USDC'],
    minTradeSize: 10,
    maxTradeSize: 100
  },
  2: {
    name: 'Momentum Bot',
    privateKey: '241083ae625b93b41b555052840c09458c71704889b22774101d21b4d1482e62',
    address: '0x48B2353954496679CF7C73d239bc12098cB0C5B4',
    strategy: 'momentum',
    risk: 'moderate',
    maxAllocation: 20,
    tradingPairs: ['PLN/ETH', 'PLN/USDC'],
    minTradeSize: 15,
    maxTradeSize: 200
  },
  3: {
    name: 'Technical Bot',
    privateKey: '0aa4b2f50b7efc44721b23a2ef7fc3ab11b658369af23381752c6d86b42628b1',
    address: '0x43f76157E9696302E287181828cB3B0C6B89d31e',
    strategy: 'technical',
    risk: 'moderate',
    maxAllocation: 20,
    tradingPairs: ['PLN/ETH', 'PLN/USDC'],
    minTradeSize: 15,
    maxTradeSize: 150
  },
  4: {
    name: 'Mean Reversion Bot',
    privateKey: '7dde37bea0f47ea849c9a7a285f3a277acd81c908accdb501ca036db1a5b11da',
    address: '0xC02764913ce2F23B094F0338a711EFD984024A46',
    strategy: 'mean-reversion',
    risk: 'moderate',
    maxAllocation: 20,
    tradingPairs: ['PLN/ETH', 'PLN/USDC'],
    minTradeSize: 12,
    maxTradeSize: 180
  },
  5: {
    name: 'Breakout Bot',
    privateKey: '64da71a2688d24c0f970ded84d2d744081e467ae493f4c3256c4f8ee9bb959ee',
    address: '0x00FfF703fa6837A1a46b3DF9B6a047404046379E',
    strategy: 'breakout',
    risk: 'high',
    maxAllocation: 25,
    tradingPairs: ['PLN/ETH', 'PLN/USDC'],
    minTradeSize: 20,
    maxTradeSize: 300
  }
};

// Base Sepolia network configuration
const BASE_SEPOLIA_CONFIG = {
  chainId: 84532,
  name: 'Base Sepolia',
  rpcUrl: 'https://sepolia.base.org',
  explorerUrl: 'https://sepolia.basescan.org',
  contracts: {
    plnToken: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    pollenDAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
    vePLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
    leagues: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a'
  },
  gasPrice: '0.1', // gwei
  gasLimit: 500000,
  confirmations: 1
};

module.exports = {
  BOT_CONFIGS,
  BASE_SEPOLIA_CONFIG
};