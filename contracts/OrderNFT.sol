pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OrderNFT is ERC1155URIStorage, Ownable {
    constructor() ERC1155("") Ownable(msg.sender) {}

    uint256 public tokenId;

    /**
     * @dev Mints a single copy of `tokenId` to `to` and sets its `tokenUri`.
     * Can only be called by the contract owner (expected to be MidnaMarketCore).
     */
    function mint(
        address buyer,
        address seller,
        string memory tokenUri
    ) external onlyOwner {
        tokenId += 1;
        string memory existing = uri(tokenId);
        if (bytes(existing).length == 0) {
            _setURI(tokenId, tokenUri);
        } else {
            require(
                keccak256(bytes(existing)) == keccak256(bytes(tokenUri)),
                "Token URI mismatch"
            );
        }
        // For same token there are two owner, enabled by ERC1155
        _mint(buyer, tokenId, 1, "");
        _mint(seller, tokenId, 1, "");
    }

    // Note: ERC1155URIStorage already provides the uri(uint256) override.
}
