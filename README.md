# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.js
```

# Order NFT System

A Hardhat project for minting NFTs to both buyers and sellers when orders are settled.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a Pinata API key with proper permissions:
   - Go to https://app.pinata.cloud/developers/api-keys
   - Click "New Key"
   - Enable these permissions:
     - `pinFileToIPFS: true`
     - `pinJSONToIPFS: true` 
     - `userPinnedDataTotal: true`
   - Or simply enable "Admin" for full access
   - Copy the JWT token

3. Run the settlement script:
```bash
# Start Hardhat network (in one terminal)
npx hardhat node

# Run the script (in another terminal)
PINATA_JWT=your_jwt_token npx hardhat run scripts/settleOrder.js --network localhost
```

## What the Script Does

1. Deploys OrderNFT and MidnaMarketCore contracts
2. Creates an order with seller/buyer/prices
3. Fulfills the order (buyer accepts)
4. Uploads metadata to Pinata IPFS
5. Calls `settle()` with the IPFS URI
6. Mints NFTs to both buyer and seller
7. Verifies the settlement

## Contract Architecture

- `OrderNFT.sol`: ERC1155 contract for order completion NFTs
- `MidnaMarketCore.sol`: Main contract handling order lifecycle
- Orders go through: Create → Fulfill → Settle → NFT Minted

## Troubleshooting

### Pinata Permission Error
If you get "NO_SCOPES_FOUND" error, your API key lacks permissions. Create a new key with the required scopes listed above.

### Network Issues
Make sure `npx hardhat node` is running before executing the script.
