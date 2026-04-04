// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SecurityTestNFT is ERC721, Ownable {
    uint256 private _nextTokenId;

    event TestNFTMinted(address indexed to, uint256 indexed tokenId);

    constructor() ERC721("Security Test NFT", "STNFT") {}

    function mint(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _safeMint(to, tokenId);
        emit TestNFTMinted(to, tokenId);
        _nextTokenId++;
        return tokenId;
    }

    function getNextTokenId() public view returns (uint256) {
        return _nextTokenId;
    }
}