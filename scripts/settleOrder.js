// Env vars required:
//   PINATA_JWT      – Pinata JWT token (https://app.pinata.cloud/developers/api-keys)
//
// This script:
// 1. Uses Hardhat's default localhost network (http://127.0.0.1:8545)
// 2. Uses the first default Hardhat account as the signer
// 3. Deploys contracts if needed, or uses existing deployment
// 4. Creates an order, fulfills it, then settles it with Pinata metadata

require("dotenv").config();
const { PinataSDK } = require("pinata-web3");
const hre = require("hardhat");

async function uploadMetadata(pinata, orderId, seller, buyer, basePrice, settlementAmount, disputed) {
  // Example metadata – customise as needed
  const metadata = {
    name: `Midna Order completetion NFT`,
    description: `NFT minted to buyer and seller after successfull trade settlement on Midna`,
    images: ["https://picsum.photos/200/300", "https://picsum.photos/200/300", "https://picsum.photos/200/300"], // placeholder image
    attributes: [
      {
        trait_type: "Order ID",
        value: orderId,
      },
      {
        trait_type: "Seller",
        value: seller,
      },
      {
        trait_type: "Buyer",
        value: buyer,
      },
      {
        trait_type: "Base Price (USDC)",
        value: basePrice.toString(),
      },
      {
        trait_type: "Settlement Amount (USDC)",
        value: settlementAmount.toString(),
      },

      {
        trait_type: "Order Creation Timestamp",
        value: Math.floor(Date.now() / 1000).toString(), // Unix timestamp for order creation
      },
      {
        trait_type: "Settlement Timestamp",
        value: Math.floor(Date.now() / 1000).toString(), // Unix timestamp for settlement
      },
      {
        trait_type: "Network",
        value: "Hardhat Local",
      },
      {
        trait_type: "Disputed",
        value: disputed,
      },
      {
        trait_type: "Status",
        value: "Completed",
      },
    ],
  };

  console.log("Uploading metadata:", JSON.stringify(metadata, null, 2));

  try {
    const res = await pinata.upload.json(metadata);
    const cid = res.IpfsHash || res.ipfsHash; // SDK may use either key casing
    if (!cid) throw new Error("Missing IpfsHash in Pinata response");

    const ipfsUri = `ipfs://${cid}`;
    const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;

    console.log("✓ Metadata uploaded successfully!");
    console.log("  IPFS URI:", ipfsUri);
    console.log("  Gateway URL:", gatewayUrl);
    console.log("  You can visit the gateway URL in your browser to see the metadata");

    return ipfsUri;
  } catch (error) {
    if (error.message.includes("NO_SCOPES_FOUND")) {
      console.error("\n❌ Pinata API Key Permission Error!");
      throw error;
    }
    throw error;
  }
}

async function deployContracts() {
  console.log("Deploying contracts...");

  // Deploy OrderNFT
  const OrderNFT = await hre.ethers.getContractFactory("OrderNFT");
  const orderNFT = await OrderNFT.deploy();
  await orderNFT.waitForDeployment();
  console.log("OrderNFT deployed to:", await orderNFT.getAddress());

  // Deploy MidnaMarketCore
  const MidnaMarketCore = await hre.ethers.getContractFactory("MidnaMarketCore");
  const marketCore = await MidnaMarketCore.deploy(await orderNFT.getAddress());
  await marketCore.waitForDeployment();
  console.log("MidnaMarketCore deployed to:", await marketCore.getAddress());

  // Transfer OrderNFT ownership to MidnaMarketCore
  await orderNFT.transferOwnership(await marketCore.getAddress());
  console.log("OrderNFT ownership transferred to MidnaMarketCore\n");

  return { orderNFT, marketCore };
}

async function main() {
  if (!process.env.PINATA_JWT) {
    console.error("Error: PINATA_JWT environment variable is required");
    console.error("Usage: PINATA_JWT=your_jwt npx hardhat run scripts/settleOrder.js --network localhost");
    process.exit(1);
  }

  // Get signers (using Hardhat's default accounts)
  const [owner, seller, buyer] = await hre.ethers.getSigners();
  console.log("Using accounts:");
  console.log("Owner (Keeper):", owner.address);
  console.log("Seller:", seller.address);
  console.log("Buyer:", buyer.address);
  console.log();

  // 1. Initialize Pinata client
  const pinata = new PinataSDK({ pinataJwt: process.env.PINATA_JWT });
  try {
    await pinata.testAuthentication();
    console.log("✓ Authenticated with Pinata\n");
  } catch (error) {
    console.error("Failed to authenticate with Pinata:", error.message);
    process.exit(1);
  }

  // 2. Deploy contracts
  const { orderNFT, marketCore } = await deployContracts();

  // 3. Create an order
  const orderId = 1;
  const basePrice = 10000000;
  const collateralAmount = 1000000;

  console.log("Creating order...");
  const createTx = await marketCore.createOrder(orderId, seller.address, basePrice, collateralAmount);
  await createTx.wait();
  console.log("✓ Order created with ID:", orderId);

  // 4. Fulfill the order (buyer accepts)
  console.log("Fulfilling order...");
  const fulfillTx = await marketCore.connect(buyer).fulfillOrder(orderId);
  await fulfillTx.wait();
  console.log("✓ Order fulfilled by buyer");

  // 5. Upload metadata to Pinata
  console.log("Uploading metadata to Pinata...");
  const tokenUri = await uploadMetadata(
    pinata,
    orderId,
    seller.address,
    buyer.address,
    basePrice,
    collateralAmount,
    false
  );
  console.log("✓ Metadata uploaded, tokenURI:", tokenUri);
  console.log();

  // 6. Settle the order
  console.log("Settling order...");
  const settleTx = await marketCore.settle(orderId, tokenUri);
  await settleTx.wait();
  console.log("✓ Order settled successfully!");

  // 7. Check NFT balances
  const tokenId = await orderNFT.tokenId();
  const sellerBalance = await orderNFT.balanceOf(seller.address, tokenId);
  const buyerBalance = await orderNFT.balanceOf(buyer.address, tokenId);

  console.log("\nNFT balances:");
  console.log("- Seller balance:", sellerBalance.toString());
  console.log("- Buyer balance:", buyerBalance.toString());

  const nftTokenUri = await orderNFT.uri(tokenId);
  console.log("- Token URI:", nftTokenUri);

  // Extract CID from IPFS URI and show gateway URL
  if (nftTokenUri.startsWith("ipfs://")) {
    const cid = nftTokenUri.replace("ipfs://", "");
    const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
    console.log("- Gateway URL:", gatewayUrl);
    console.log("- Visit the gateway URL to see the metadata in your browser!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
