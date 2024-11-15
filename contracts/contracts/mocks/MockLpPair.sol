// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockLpPair
 * @notice Minimal stand-in for a UniswapV2 pair token.
 *
 * @dev The locker decides whether a token is an LP token by calling
 *      `factory()` on it and asking that factory whether it minted the pair.
 *      Reproducing that handshake needs both halves, so this ships with a
 *      matching factory stub rather than a single fake.
 */
contract MockLpPair is ERC20 {
    address public immutable factory;
    address public immutable token0;
    address public immutable token1;

    constructor(
        address factory_,
        address token0_,
        address token1_,
        uint256 initialSupply_
    ) ERC20("Mock LP", "MLP") {
        factory = factory_;
        token0 = token0_;
        token1 = token1_;
        _mint(msg.sender, initialSupply_);
    }
}

/**
 * @title MockLpFactory
 * @notice Records which pair it "created", so `getPair` answers correctly.
 */
contract MockLpFactory {
    mapping(address => mapping(address => address)) private _pairs;

    function register(
        address tokenA,
        address tokenB,
        address pair
    ) external {
        _pairs[tokenA][tokenB] = pair;
        _pairs[tokenB][tokenA] = pair;
    }

    function getPair(address tokenA, address tokenB)
        external
        view
        returns (address)
    {
        return _pairs[tokenA][tokenB];
    }
}
