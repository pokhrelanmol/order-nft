// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "./OrderNFT.sol";

contract MidnaMarketCore is Ownable {
    struct OrderDetails {
        address seller;
        uint256 basePrice;
        uint256 collateralAmount;
        address buyer;
        bool settled;
    }

    // orderId => OrderDetails
    mapping(uint256 => OrderDetails) public orders;
    mapping(uint256 tokenId => uint256 orderId) public nftTokenIdToOrderId;
    mapping(uint256 orderId => uint256 tokenId) public orderIdToNftTokenId;

    // ERC1155 NFT contract that represents completed orders
    OrderNFT public immutable orderNFT;

    constructor(OrderNFT _orderNFT) Ownable(msg.sender) {
        orderNFT = _orderNFT;
    }

    /**
     * @dev Registers a new order. Only callable by the contract owner (keeper).
     */
    function createOrder(
        uint256 orderId,
        address seller,
        uint256 basePrice,
        uint256 collateralAmount
    ) external onlyOwner {
        require(orders[orderId].seller == address(0), "Order already exists");
        orders[orderId] = OrderDetails({
            seller: seller,
            basePrice: basePrice,
            collateralAmount: collateralAmount,
            buyer: address(0),
            settled: false
        });
    }

    /**
     * @dev Buyer calls this to accept/fulfil the order. Sets the buyer address.
     */
    function fulfillOrder(uint256 orderId) external {
        OrderDetails storage order = orders[orderId];
        require(order.seller != address(0), "Order does not exist");
        require(order.buyer == address(0), "Order already fulfilled");
        require(!order.settled, "Order already settled");

        order.buyer = msg.sender;
        // Payment / collateral transfers would happen here (omitted for brevity).
    }

    /**
     * @dev Finalises an order and mints an OrderNFT to the seller.
     * `tokenUri` should point to the off-chain metadata prepared beforehand.
     * Only callable by the keeper (contract owner).
     */
    function settle(
        uint256 orderId,
        string memory tokenUri
    ) external onlyOwner {
        OrderDetails storage order = orders[orderId];
        require(order.seller != address(0), "Order does not exist");
        require(!order.settled, "Order already settled");
        require(order.buyer != address(0), "Order not fulfilled");

        // Mint exactly one NFT representing this order to the seller and buyer
        //@audit think about reentrancy
        orderNFT.mint(order.buyer, order.seller, tokenUri);
        uint256 tokenId = orderNFT.tokenId();
        orderIdToNftTokenId[tokenId] = orderId;
        nftTokenIdToOrderId[orderId] = tokenId;

        order.settled = true;
    }
}
