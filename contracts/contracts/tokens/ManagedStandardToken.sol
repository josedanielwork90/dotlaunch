// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ManagedStandardToken
 * @notice A plain ERC20 whose optional capabilities - minting, burning,
 *         pausing and blacklisting - are fixed at construction time.
 *
 * @dev The capability flags are immutable on purpose. A buyer inspecting a
 *      presale token needs to know that a deployer cannot switch minting on
 *      after the fact, so the flags are set once by the factory and can never
 *      change. Calling a disabled capability reverts rather than silently
 *      doing nothing, so the UI surfaces a clear error.
 *
 *      Decimals are configurable because presale tokens routinely use values
 *      other than 18, and the launchpad rate maths depends on getting this right.
 */
contract ManagedStandardToken is ERC20, ERC20Burnable, Pausable, Ownable {
    /// @notice Whether `mint` is available on this token.
    bool public immutable canMint;
    /// @notice Whether `burn`/`burnFrom` are available on this token.
    bool public immutable canBurn;
    /// @notice Whether `pause`/`unpause` are available on this token.
    bool public immutable canPause;
    /// @notice Whether the blacklist is available on this token.
    bool public immutable canBlacklist;

    uint8 private immutable _decimals;

    /// @notice Addresses barred from sending or receiving, when enabled.
    mapping(address => bool) public isBlacklisted;

    event BlacklistUpdated(address indexed account, bool blacklisted);

    error CapabilityDisabled(string capability);
    error AccountBlacklisted(address account);

    /**
     * @param name_        Token name.
     * @param symbol_      Token symbol.
     * @param decimals_    Token decimals (commonly 9 or 18).
     * @param initialSupply_ Full supply, in base units, minted to `owner_`.
     * @param owner_       Receives the supply and all privileged rights.
     * @param capabilities_ [canMint, canBurn, canPause, canBlacklist].
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        address owner_,
        bool[4] memory capabilities_
    ) ERC20(name_, symbol_) {
        require(owner_ != address(0), "Token: zero owner");
        require(bytes(name_).length > 0, "Token: empty name");
        require(bytes(symbol_).length > 0, "Token: empty symbol");
        require(decimals_ <= 18, "Token: decimals too large");

        _decimals = decimals_;
        canMint = capabilities_[0];
        canBurn = capabilities_[1];
        canPause = capabilities_[2];
        canBlacklist = capabilities_[3];

        if (initialSupply_ > 0) {
            _mint(owner_, initialSupply_);
        }
        _transferOwnership(owner_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /// @notice Mint new supply. Only available when `canMint` was set.
    function mint(address to, uint256 amount) external onlyOwner {
        if (!canMint) revert CapabilityDisabled("mint");
        _mint(to, amount);
    }

    /// @notice Halt all transfers. Only available when `canPause` was set.
    function pause() external onlyOwner {
        if (!canPause) revert CapabilityDisabled("pause");
        _pause();
    }

    /// @notice Resume transfers.
    function unpause() external onlyOwner {
        if (!canPause) revert CapabilityDisabled("pause");
        _unpause();
    }

    /// @notice Add or remove an address from the blacklist.
    function setBlacklisted(address account, bool blacklisted) external onlyOwner {
        if (!canBlacklist) revert CapabilityDisabled("blacklist");
        require(account != address(0), "Token: zero account");
        isBlacklisted[account] = blacklisted;
        emit BlacklistUpdated(account, blacklisted);
    }

    /// @notice Blacklist several addresses in one call.
    function setBlacklistedBatch(address[] calldata accounts, bool blacklisted)
        external
        onlyOwner
    {
        if (!canBlacklist) revert CapabilityDisabled("blacklist");
        for (uint256 i = 0; i < accounts.length; i++) {
            require(accounts[i] != address(0), "Token: zero account");
            isBlacklisted[accounts[i]] = blacklisted;
            emit BlacklistUpdated(accounts[i], blacklisted);
        }
    }

    function burn(uint256 amount) public override {
        if (!canBurn) revert CapabilityDisabled("burn");
        super.burn(amount);
    }

    function burnFrom(address account, uint256 amount) public override {
        if (!canBurn) revert CapabilityDisabled("burn");
        super.burnFrom(account, amount);
    }

    /**
     * @dev Enforces the pause and blacklist rules on every movement of value,
     *      including mints and burns.
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        virtual
        override
        whenNotPaused
    {
        if (canBlacklist) {
            if (isBlacklisted[from]) revert AccountBlacklisted(from);
            if (isBlacklisted[to]) revert AccountBlacklisted(to);
        }
        super._beforeTokenTransfer(from, to, amount);
    }
}
