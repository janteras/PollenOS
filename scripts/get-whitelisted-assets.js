const { ethers } = require('ethers');
const config = require('./config');
const PollenDAOABI = require('../reference-code/pollen-subgraph-v3/abis/IPollenDAO.json');

async function getWhitelistedAssets() {
  try {
    // Initialize provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log('🔍 Fetching whitelisted assets from PollenDAO...');
    
    // Contract instance
    const dao = new ethers.Contract(config.CONTRACTS.POLLEN_DAO, PollenDAOABI, wallet);
    
    // Get assets using getAssets function
    try {
      console.log('\nCalling getAssets() on PollenDAO...');
      const assets = await dao.getAssets();
      console.log('\n✅ Whitelisted Assets:', assets);
      
      if (assets.length === 0) {
        console.log('No whitelisted assets found.');
      } else {
        console.log('\nAsset Details:');
        for (let i = 0; i < assets.length; i++) {
          console.log(`${i + 1}. ${assets[i]}`);
        }
        console.log(`\nTotal whitelisted assets: ${assets.length}`);
      }
      
      return assets;
      
    } catch (error) {
      console.error('Error calling getAssets():', error);
      
      // Fallback to checking events if getAssets fails
      console.log('\nFalling back to checking AssetAdded events...');
      try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000); // Check last 10k blocks
        
        const filter = dao.filters.AssetAdded();
        const events = await dao.queryFilter(filter, fromBlock, 'latest');
        
        if (events.length > 0) {
          const assets = [...new Set(events.map(e => e.args.asset))];
          console.log('\n✅ Found whitelisted assets from events:');
          assets.forEach((asset, i) => console.log(`${i + 1}. ${asset}`));
          return assets;
        } else {
          console.log('\n❌ No whitelisted assets found in events.');
          return [];
        }
      } catch (eventError) {
        console.error('Error checking AssetAdded events:', eventError);
        return [];
      }
    }
    
  } catch (error) {
    console.error('Error in getWhitelistedAssets:', error);
    return [];
  }
}

// Run the function if called directly
if (require.main === module) {
  getWhitelistedAssets()
    .then(assets => {
      if (assets && assets.length > 0) {
        // Export the assets for use in other scripts
        module.exports.assets = assets;
      }
    })
    .catch(console.error);
} else {
  module.exports = getWhitelistedAssets;
}
