
/**
 * Complete Pollen Smart Contract ABI
 * Based on verified contract functions from Snowtrace
 */

// PLN Token ABI (ERC20)
const PLN_TOKEN_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)'
];

// Main Pollen Contract ABI (vePLN Staking Contract)
const POLLEN_MAIN_CONTRACT_ABI = [
  // ERC20 Standard Functions
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address recipient, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)',
  'function increaseAllowance(address spender, uint256 addedValue) external returns (bool)',
  'function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool)',
  
  // vePLN Locking Functions
  'function lock(uint256 amount, uint256 lockEnd) external',
  'function increaseLock(uint256 amount) external',
  'function extendLock(uint256 newLockEnd) external',
  'function updateLock(uint256 extraAmount, uint256 newLockEnd) external',
  'function unlock() external',
  
  // Rewards Functions
  'function claimRewards() external',
  'function getAvailableRewards(address account) external view returns (uint256)',
  'function getClaimableRewards() external view returns (uint256)',
  'function getBoostingRate(address account) external view returns (uint256)',
  
  // Governance Functions
  'function getVotingPower(address account) external view returns (uint256)',
  
  // State View Functions
  'function locks(address) external view returns (uint256 lockStart, uint256 lockEnd, uint256 amount, uint256 offset, uint256 claimable)',
  'function stakeInfo(address) external view returns (uint256 offsetY)',
  'function totalLocked() external view returns (uint256)',
  'function rewardCurve() external view returns (uint256 rate, uint256 offsetX, uint256 offsetY, uint256 sumBias)',
  
  // Constants
  'function MAX_REWARDS_FUNDS() external view returns (uint256)',
  'function TOTAL_REWARD_PER_SECOND() external view returns (uint256)',
  
  // Admin Functions
  'function burn(address account, uint256 amount) external',
  
  // Events
  'event LockCreated(address indexed account, uint256 amount, uint256 lockEndTime)',
  'event LockExtended(address indexed account, uint256 newLockEndTime)',
  'event LockIncreased(address indexed account, uint256 amount)',
  'event UnLocked(address indexed account, uint256 amount, uint256 claimable)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

// Asset Contract ABI (for individual asset trading)
const POLLEN_ASSET_CONTRACT_ABI = [
  'function openPosition(address user, uint256 amount, bool isLong, uint256 leverage) external',
  'function closePosition(address user) external',
  'function getPosition(address user) external view returns (uint256 amount, bool isLong, uint256 leverage, uint256 entryPrice)',
  'function getCurrentPrice() external view returns (uint256)',
  'function maxLeverage() external view returns (uint256)',
  
  // Events
  'event PositionOpened(address indexed user, uint256 amount, bool isLong, uint256 leverage, uint256 entryPrice)',
  'event PositionClosed(address indexed user, uint256 pnl, uint256 exitPrice)'
];

module.exports = {
  PLN_TOKEN_ABI,
  POLLEN_MAIN_CONTRACT_ABI,
  POLLEN_ASSET_CONTRACT_ABI
};
