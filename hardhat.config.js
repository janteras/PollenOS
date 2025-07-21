require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Contract addresses on different networks
const CONTRACTS = {
  // Avalanche mainnet
  avalanche: {
    vePLN: "0x2eCB6F9dF29163758024d416997764922E4528d4",
    plnToken: "0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf",
    pollenDAO: "0x8B312F4503790CBd1030b97C545c7F3eFDaDE717",
    proxyStorage: "0xDd612d373D6ba328901571434ef76bd1751Df661"
  },
  // Base Sepolia testnet
  baseSepolia: {
    pollenDAO: "0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7",
    leagues: "0x55F04Ee2775925b80125F412C05cF5214Fd1317a",
    vePLN: "0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995",
    plnToken: "0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6"
  }
};

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
        blockNumber: process.env.FORK_BLOCK_NUMBER ? parseInt(process.env.FORK_BLOCK_NUMBER) : undefined
      },
      chainId: 43114 // Avalanche mainnet
    },
    avalanche: {
      url: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
      accounts: process.env.WALLET_PRIVATE_KEY ? [process.env.WALLET_PRIVATE_KEY] : []
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      chainId: 84532,
      accounts: process.env.WALLET_PRIVATE_KEY ? [process.env.WALLET_PRIVATE_KEY] : [],
      gasPrice: "auto",
      gas: "auto"
    }
  },
  etherscan: {
    apiKey: {
      avalanche: process.env.SNOWTRACE_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  },
  // Export contract addresses for use in tests and scripts
  contractAddresses: CONTRACTS
}; 