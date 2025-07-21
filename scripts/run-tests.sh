#!/bin/bash

# Exit on error
set -e

# Colors
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${GREEN}Installing dependencies...${NC}"
  npm install mocha chai @nomiclabs/hardhat-ethers ethers@5.7.2 dotenv
fi

# Run tests
echo -e "\n${GREEN}Running Portfolio Manager Tests...${NC}"
npx mocha ./scripts/test-portfolio-manager.js --timeout 60000 --exit

echo -e "\n${GREEN}All tests completed successfully!${NC}"
