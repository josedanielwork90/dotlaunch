// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice A mintable ERC20 with configurable decimals, for tests only.
 *
 * @dev Presale tokens routinely use 9 decimals rather than 18 and the rate
 *      maths depends on reading that correctly, so the test token has to be
 *      able to lie about its decimals the same way a real one can.
 */
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply_);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Mint to any address. Test-only convenience.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Burn from any address. Test-only convenience.
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
