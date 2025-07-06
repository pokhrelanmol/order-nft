const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("MidnaMarketCore", function () {
  async function deployMidnaMarketCoreFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, seller, buyer] = await ethers.getSigners();

    const MidnaMarketCore = await ethers.getContractFactory("MidnaMarketCore");
    const OrderNFT = await ethers.getContractFactory("OrderNFT");
    const orderNFT = await OrderNFT.deploy();

    const midnaMarketCore = await MidnaMarketCore.deploy(orderNFT.target);

    // Transfer NFT ownership to market core so it can mint
    await orderNFT.transferOwnership(midnaMarketCore.target);

    return { midnaMarketCore, orderNFT, owner, seller, buyer };
  }

  describe("createOrder", function () {
    it("owner should be able to create an order", async function () {
      const { midnaMarketCore, orderNFT, owner, seller, buyer } = await loadFixture(deployMidnaMarketCoreFixture);
      await midnaMarketCore.createOrder(1, seller.address, 100, 0);
      let order = await midnaMarketCore.orders(1);
      expect(order.seller).to.equal(seller.address);
      //buyer. TODO:call from buyer address
      await midnaMarketCore.connect(buyer).fulfillOrder(1);
      order = await midnaMarketCore.orders(1);
      expect(order.buyer).to.equal(buyer.address);

      //settle
      await midnaMarketCore.settle(1, "URI");
      order = await midnaMarketCore.orders(1);
      expect(order.settled).to.equal(true);

      // check NFT balance of seller and buyer
      const sellerBalance = await orderNFT.balanceOf(seller.address, 1);
      const buyerBalance = await orderNFT.balanceOf(buyer.address, 1);

      expect(sellerBalance).to.equal(1);
      expect(buyerBalance).to.equal(1);
    });
  });
});
