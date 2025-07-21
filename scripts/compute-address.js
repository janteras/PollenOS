const { ethers } = require('ethers');
const { getCreate2Address } = require('ethers/lib/utils');

// PollenDAO contract address
const FACTORY_ADDRESS = '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7';
// The init code hash for the portfolio contract (you'll need to get this from the contract)
const INIT_CODE_HASH = '0x...'; // Replace with actual init code hash

// Function to compute the CREATE2 address
function computeAddress(salt) {
  return getCreate2Address(
    FACTORY_ADDRESS,
    salt,
    INIT_CODE_HASH
  );
}

// Example usage with a salt (you'll need to find the correct salt)
const salt = '0x' + '0'.repeat(64); // Replace with actual salt
const computedAddress = computeAddress(salt);
console.log('Computed Address:', computedAddress);

// Function to compute the CREATE address (for non-CREATE2)
function computeCreateAddress(nonce) {
  const address = FACTORY_ADDRESS.toLowerCase().replace('0x', '');
  const nonceHex = nonce.toString(16).padStart(64, '0');
  const rlpEncoded = ethers.utils.RLP.encode([address, '0x' + nonceHex]);
  const hash = ethers.utils.keccak256(rlpEncoded);
  return '0x' + hash.slice(26);
}

// Try with different nonces
for (let i = 0; i < 10; i++) {
  console.log(`Nonce ${i}:`, computeCreateAddress(i));
}
