const { ethers } = require('ethers');

// Raw event data
const rawData = '0x0000000000000000000000000000000000000000000000008ac7230489e800000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000070000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e';

// Remove the 0x prefix and split into 32-byte chunks
const data = rawData.startsWith('0x') ? rawData.slice(2) : rawData;
const chunks = [];
for (let i = 0; i < data.length; i += 64) {
  chunks.push('0x' + data.slice(i, i + 64));
}

console.log('Raw Data Chunks:');
chunks.forEach((chunk, i) => console.log(`${i}: ${chunk}`));

// First chunk: creator address (padded to 32 bytes)
const creator = '0x' + chunks[0].slice(-40);
console.log('\nCreator:', creator);

// Second chunk: amount (uint256)
const amount = ethers.BigNumber.from(chunks[1]);
console.log('Amount:', amount.toString());

// Third chunk: offset to weights array (should be 0x60 for dynamic array)
const weightsOffset = parseInt(chunks[2], 16);
console.log('Weights Offset:', weightsOffset);

// Fourth chunk: length of weights array
const weightsLength = parseInt(chunks[3], 16);
console.log('Weights Length:', weightsLength);

// Weights start at the offset (0x60 / 32 = 3)
console.log('\nWeights:');
for (let i = 0; i < weightsLength; i++) {
  const weight = ethers.BigNumber.from(chunks[4 + i]);
  console.log(`- Weight ${i}:`, weight.toString());
  
  // Try to interpret as address
  const asAddress = '0x' + weight.toHexString().slice(2).padStart(40, '0');
  console.log(`  As Address: ${asAddress}`);
}

// The last chunk might contain the portfolio address
console.log('\nPossible Portfolio Address:');
const possiblePortfolio = '0x' + chunks[chunks.length - 1].slice(-40);
console.log(possiblePortfolio);
