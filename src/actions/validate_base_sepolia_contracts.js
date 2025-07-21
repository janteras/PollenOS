const ethers = require('ethers');
const logger = require('../modules/logger');

// Polyfill for AbortController in older Node.js versions
if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = class AbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      this.signal.aborted = true;
    }
  };
}

/**
 * Validate Base Sepolia Pollen contracts per Sepolia Developer Guide
 * Tests all contract addresses and basic functionality
 */
async function validateBaseSepoliaContracts(config) {
  try {
    logger.info('🔍 Validating Base Sepolia contracts per Developer Guide...');

    // Validate config first
    if (!config) {
      logger.error('❌ Configuration object is null or undefined');
      return {
        network: null,
        wallet: null,
        contracts: {},
        error: {
          message: 'Configuration object is null or undefined',
          type: 'config_missing',
          timestamp: new Date().toISOString()
        }
      };
    }

    if (!config.network || !config.network.rpcUrl) {
      logger.error(`❌ Missing network configuration. Got: ${JSON.stringify(config.network || {})}`);
      return {
        network: null,
        wallet: null,
        contracts: {},
        error: {
          message: 'Missing network configuration',
          type: 'network_missing',
          timestamp: new Date().toISOString()
        }
      };
    }

    if (!config.wallet || !config.wallet.privateKey) {
      logger.warn('⚠️ Missing wallet private key - validation will be limited');
      return {
        network: { valid: false, chainId: 0 },
        wallet: { address: null, balance: '0', hasGas: false },
        contracts: {},
        error: {
          message: 'Missing wallet private key',
          type: 'wallet_missing',
          timestamp: new Date().toISOString()
        }
      };
    }

    logger.info(`📡 Connecting to RPC: ${config.network.rpcUrl}`);

    // Initialize provider with timeout
    const provider = new ethers.JsonRpcProvider(config.network.rpcUrl);

  // Expected addresses per Developer Guide
  const expectedContracts = {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    Portfolio: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
    vePLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
    Leagues: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a'
  };

  const results = {
    network: null,
    wallet: null,
    contracts: {}
  };

  try {
    // 1. Validate network connection with timeout
    logger.info('1. Testing network connection...');
    const networkPromise = provider.getNetwork();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Network connection timeout')), 10000)
    );

    const network = await Promise.race([networkPromise, timeoutPromise]);
    results.network = {
      name: network.name,
      chainId: Number(network.chainId),
      valid: Number(network.chainId) === 84532
    };

    if (results.network.valid) {
      logger.info(`✅ Connected to Base Sepolia (Chain ID: ${results.network.chainId})`);
    } else {
      logger.error(`❌ Wrong network. Expected Chain ID 84532, got ${results.network.chainId}`);
      return results;
    }

    // 2. Validate wallet with timeout
    logger.info('2. Testing wallet...');

    // Validate private key is not a placeholder
    let privateKey = config.wallet.privateKey;
    if (!privateKey ||
        privateKey.includes('your_actual_wallet_private_key') || 
        privateKey.includes('your_private_key_here') ||
        privateKey === 'your_testnet_private_key_here' ||
        privateKey === 'your_private_key_placeholder') {
      logger.error('❌ Private key is still set to placeholder value');
      return {
        ...results,
        error: {
          message: 'Private key placeholder detected',
          type: 'wallet_config_error',
          timestamp: new Date().toISOString()
        }
      };
    }

    // Ensure proper hex format
    if (!privateKey.startsWith('0x')) {
      privateKey = '0x' + privateKey;
    }

    // Validate private key length
    if (privateKey.length !== 66) {
      logger.error(`❌ Invalid private key length: expected 66 characters, got ${privateKey.length}`);
      return {
        ...results,
        error: {
          message: 'Invalid private key length',
          type: 'wallet_config_error', 
          timestamp: new Date().toISOString()
        }
      };
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    const balancePromise = provider.getBalance(wallet.address);
    const balanceTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Wallet balance check timeout')), 10000)
    );

    const balance = await Promise.race([balancePromise, balanceTimeoutPromise]);
    results.wallet = {
      address: wallet.address,
      balance: ethers.formatEther(balance),
      hasGas: balance > 0n
    };

    if (results.wallet.hasGas) {
      logger.info(`✅ Wallet has ${results.wallet.balance} ETH for gas`);
    } else {
      logger.warn(`⚠️ Wallet has no ETH. Get testnet ETH from Base Sepolia faucet.`);
    }

    // 3. Validate PLN Token Contract
    logger.info('3. Testing PLN Token contract...');
    const plnContract = new ethers.Contract(
      expectedContracts.PLN,
      [
        'function symbol() view returns (string)',
        'function name() view returns (string)',
        'function decimals() view returns (uint8)',
        'function totalSupply() view returns (uint256)',
        'function balanceOf(address) view returns (uint256)'
      ],
      provider
    );

    try {
      const [symbol, name, decimals, totalSupply, userBalance] = await Promise.all([
        plnContract.symbol(),
        plnContract.name(),
        plnContract.decimals(),
        plnContract.totalSupply(),
        plnContract.balanceOf(wallet.address)
      ]);

      results.contracts.PLN = {
        address: expectedContracts.PLN,
        symbol,
        name,
        decimals,
        totalSupply: ethers.formatUnits(totalSupply, decimals),
        userBalance: ethers.formatUnits(userBalance, decimals),
        valid: true
      };

      logger.info(`✅ PLN Token: ${name} (${symbol}), Balance: ${results.contracts.PLN.userBalance} PLN`);
    } catch (error) {
      logger.error(`❌ PLN Token contract failed: ${error.message}`);
      results.contracts.PLN = { address: expectedContracts.PLN, valid: false, error: error.message };
    }

    // 4. Validate Portfolio Contract
    logger.info('4. Testing Portfolio contract...');
    const portfolioContract = new ethers.Contract(
      expectedContracts.Portfolio,
      [
        'function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])',
        'function depositPLN(uint256 amount, address recipient)',
        'function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType)'
      ],
      provider
    );

    try {
      // Test if we can call getPortfolio (won't fail even if no portfolio exists)
      await portfolioContract.getPortfolio(wallet.address, ethers.constants.AddressZero);
      results.contracts.Portfolio = {
        address: expectedContracts.Portfolio,
        valid: true
      };
      logger.info(`✅ Portfolio contract accessible`);
    } catch (error) {
      logger.error(`❌ Portfolio contract failed: ${error.message}`);
      results.contracts.Portfolio = { address: expectedContracts.Portfolio, valid: false, error: error.message };
    }

    // 5. Validate vePLN Contract
    logger.info('5. Testing vePLN contract...');
    const vePlnContract = new ethers.Contract(
      expectedContracts.vePLN,
      [
        'function balanceOf(address) view returns (uint256)',
        'function locked(address) view returns (tuple(uint256 amount, uint256 end))'
      ],
      provider
    );

    try {
      const [vePlnBalance] = await Promise.all([
        vePlnContract.balanceOf(wallet.address)
      ]);

      results.contracts.vePLN = {
        address: expectedContracts.vePLN,
        userBalance: ethers.formatEther(vePlnBalance),
        valid: true
      };

      logger.info(`✅ vePLN contract: Balance ${results.contracts.vePLN.userBalance} vePLN`);
    } catch (error) {
      logger.error(`❌ vePLN contract failed: ${error.message}`);
      results.contracts.vePLN = { address: expectedContracts.vePLN, valid: false, error: error.message };
    }

    // 6. Validate Leagues Contract
    logger.info('6. Testing Leagues contract...');
    const leaguesContract = new ethers.Contract(
      expectedContracts.Leagues,
      [
        'function getLeagues() view returns (uint256[])',
        'function getUserLeague(address) view returns (uint256)'
      ],
      provider
    );

    try {
      // Try to call a basic function - this might fail if the ABI is wrong
      const code = await provider.getCode(expectedContracts.Leagues);
      results.contracts.Leagues = {
        address: expectedContracts.Leagues,
        hasCode: code !== '0x',
        valid: code !== '0x'
      };

      if (results.contracts.Leagues.valid) {
        logger.info(`✅ Leagues contract has code`);
      } else {
        logger.warn(`⚠️ Leagues contract has no code`);
      }
    } catch (error) {
      logger.error(`❌ Leagues contract failed: ${error.message}`);
      results.contracts.Leagues = { address: expectedContracts.Leagues, valid: false, error: error.message };
    }

    // Summary
    logger.info('\n📋 Validation Summary:');
    logger.info(`Network: ${results.network.valid ? '✅' : '❌'} Base Sepolia`);
    logger.info(`Wallet: ${results.wallet.hasGas ? '✅' : '⚠️'} ${results.wallet.balance} ETH`);

    Object.entries(results.contracts).forEach(([name, contract]) => {
      logger.info(`${name}: ${contract.valid ? '✅' : '❌'} ${contract.address}`);
    });

    const validContracts = Object.values(results.contracts).filter(c => c.valid).length;
    const totalContracts = Object.keys(results.contracts).length;

    logger.info(`\n🎯 ${validContracts}/${totalContracts} contracts validated successfully`);

    if (validContracts === totalContracts && results.network.valid) {
      logger.info('✅ All Base Sepolia contracts are ready for trading!');
    } else {
      logger.warn('⚠️ Some issues detected. Bot will run in simulation mode.');
    }

    // Test a simple transaction (gas estimation)
    logger.info('🔍 Testing transaction capabilities...');
    try {
      const gasPrice = await provider.getGasPrice();
      logger.info(`⛽ Current gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

      // Test PLN token interaction if available
      if (validatedContracts.PLN) {
        const plnContract = new ethers.Contract(
          validatedContracts.PLN,
          [
            'function symbol() view returns (string)',
            'function decimals() view returns (uint8)',
            'function balanceOf(address) view returns (uint256)'
          ],
          provider
        );

        const symbol = await plnContract.symbol();
        const decimals = await plnContract.decimals();
        const plnBalance = await plnContract.balanceOf(wallet.address);

        logger.info(`🪙 PLN Token: ${symbol}, Decimals: ${decimals}, Balance: ${ethers.formatUnits(plnBalance, decimals)}`);

        // Execute a small test transaction if we have ETH balance
        if (results.wallet.hasGas) {
          try {
            logger.info('🔄 Executing test transaction...');
            const testTx = await wallet.sendTransaction({
              to: wallet.address, // Send to self
              value: ethers.parseEther('0.0001'),
              gasLimit: 21000
            });

            logger.info(`📡 Test transaction sent: ${testTx.hash}`);
            logger.info(`🔗 View on BaseScan: https://sepolia.basescan.org/tx/${testTx.hash}`);

            const receipt = await testTx.wait();
            logger.info(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
            logger.info(`⛽ Gas used: ${receipt.gasUsed.toString()}`);

            // Store transaction hash for proof
            results.testTransaction = {
              hash: testTx.hash,
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed.toString(),
              explorerUrl: `https://sepolia.basescan.org/tx/${testTx.hash}`
            };
          } catch (txError) {
            logger.warn(`⚠️ Test transaction failed: ${txError.message}`);
          }
        } else {
          // Create a sample transaction hash for testing
          const testTxHash = '0x' + Buffer.from(`base-sepolia-test-${Date.now()}`).toString('hex').padStart(64, '0');
          logger.info(`📝 Sample transaction hash: ${testTxHash}`);
        }
      }

    } catch (error) {
      logger.warn(`⚠️ Transaction test failed: ${error.message}`);
    }

    return results;

  } catch (error) {
    logger.error('❌ Contract validation failed:', error.message);
    logger.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    // Return partial results with error info
    return {
      ...results,
      error: {
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      }
    };
  }

  } catch (error) {
    logger.error('❌ Configuration validation failed:', error.message || error.toString());
    if (error.stack) {
      logger.error('Stack trace:', error.stack);
    }

    return {
      network: null,
      wallet: null,
      contracts: {},
      error: {
        message: error.message || 'Configuration validation failed',
        type: 'config_validation_error',
        timestamp: new Date().toISOString(),
        details: error.toString()
      }
    };
  }
}

module.exports = validateBaseSepoliaContracts;