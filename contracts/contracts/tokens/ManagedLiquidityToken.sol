// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ManagedLiquidityToken
 * @notice A fee-on-transfer ("liquidity generator") ERC20. A configurable
 *         percentage of each taxed transfer is diverted to a liquidity
 *         reserve, a marketing wallet, a holder-reward pool and/or burned.
 *
 * @dev Fees are expressed in basis points (100 = 1%) and are validated
 *      against MAX_TOTAL_FEE_BPS at construction, so a deployer cannot ship a
 *      token that takes an unbounded cut. Fees are immutable once set - the
 *      common rug vector in this token class is an owner raising the sell tax
 *      after launch, and making the values immutable removes it entirely.
 *
 *      Fees apply only to transfers between two non-exempt addresses. Mints,
 *      burns, and any transfer touching an exempt address (the owner, this
 *      contract, and the launchpad during a presale) move at par, which is
 *      what keeps presale accounting exact.
 */
contract ManagedLiquidityToken is ERC20, ERC20Burnable, Pausable, Ownable {
    /// @notice Basis-point denominator. 10_000 bps == 100%.
    uint256 public constant BPS_DENOMINATOR = 10_000;
    /// @notice Hard ceiling on the sum of all fees (25%).
    uint256 public constant MAX_TOTAL_FEE_BPS = 2_500;

    // ── settingFlag bits ──────────────────────────────────────────────────
    /// @notice Enforce `maxTransactionAmount` on taxed transfers.
    uint256 public constant FLAG_MAX_TX_LIMIT = 1 << 0;
    /// @notice Enforce `maxWalletAmount` on taxed transfers.
    uint256 public constant FLAG_MAX_WALLET_LIMIT = 1 << 1;
    /// @notice Exempt the owner from fees.
    uint256 public constant FLAG_EXEMPT_OWNER = 1 << 2;
    /// @notice Send the burn share to address(0) rather than the reserve.
    uint256 public constant FLAG_AUTO_BURN = 1 << 3;

    /// @notice Fee taken for the liquidity reserve, in bps.
    uint256 public immutable liquidityFeeBps;
    /// @notice Fee routed to the marketing wallet, in bps.
    uint256 public immutable marketingFeeBps;
    /// @notice Fee routed to the holder-reward pool, in bps.
    uint256 public immutable rewardFeeBps;
    /// @notice Fee burned on each taxed transfer, in bps.
    uint256 public immutable burnFeeBps;

    /// @notice Bitmask of the FLAG_* constants above.
    uint256 public immutable settingFlag;

    /// @notice Receives the marketing and liquidity shares.
    address public immutable feeReceiver;

    bool public immutable canMint;
    bool public immutable canBurn;
    bool public immutable canPause;
    bool public immutable canBlacklist;

    uint8 private immutable _decimals;

    /// @notice Per-transfer cap, when FLAG_MAX_TX_LIMIT is set.
    uint256 public maxTransactionAmount;
    /// @notice Per-wallet cap, when FLAG_MAX_WALLET_LIMIT is set.
    uint256 public maxWalletAmount;

    /// @notice Addresses that move tokens at par.
    mapping(address => bool) public isFeeExempt;
    /// @notice Addresses barred from transacting, when enabled.
    mapping(address => bool) public isBlacklisted;

    event FeeExemptionUpdated(address indexed account, bool exempt);
    event BlacklistUpdated(address indexed account, bool blacklisted);
    event LimitsUpdated(uint256 maxTransactionAmount, uint256 maxWalletAmount);
    event FeesCollected(
        address indexed from,
        uint256 liquidityAmount,
        uint256 marketingAmount,
        uint256 rewardAmount,
        uint256 burnAmount
    );

    error CapabilityDisabled(string capability);
    error AccountBlacklisted(address account);
    error ExceedsMaxTransaction(uint256 amount, uint256 limit);
    error ExceedsMaxWallet(uint256 balanceAfter, uint256 limit);

    /**
     * @param name_        Token name.
     * @param symbol_      Token symbol.
     * @param decimals_    Token decimals.
     * @param initialSupply_ Full supply in base units, minted to `owner_`.
     * @param owner_       Receives the supply and privileged rights.
     * @param feeReceiver_ Wallet receiving liquidity and marketing shares.
     * @param fees_        [liquidity, marketing, reward, burn] in bps.
     * @param settingFlag_ Bitmask of the FLAG_* constants.
     * @param capabilities_ [canMint, canBurn, canPause, canBlacklist].
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        address owner_,
        address feeReceiver_,
        uint256[4] memory fees_,
        uint256 settingFlag_,
        bool[4] memory capabilities_
    ) ERC20(name_, symbol_) {
        require(owner_ != address(0), "Token: zero owner");
        require(feeReceiver_ != address(0), "Token: zero fee receiver");
        require(bytes(name_).length > 0, "Token: empty name");
        require(bytes(symbol_).length > 0, "Token: empty symbol");
        require(decimals_ <= 18, "Token: decimals too large");

        uint256 totalFee = fees_[0] + fees_[1] + fees_[2] + fees_[3];
        require(totalFee <= MAX_TOTAL_FEE_BPS, "Token: total fee too high");

        liquidityFeeBps = fees_[0];
        marketingFeeBps = fees_[1];
        rewardFeeBps = fees_[2];
        burnFeeBps = fees_[3];
        settingFlag = settingFlag_;
        feeReceiver = feeReceiver_;

        canMint = capabilities_[0];
        canBurn = capabilities_[1];
        canPause = capabilities_[2];
        canBlacklist = capabilities_[3];

        _decimals = decimals_;

        // Sensible opening limits: 1% per transfer, 2% per wallet. Only
        // enforced when the corresponding flag is set.
        maxTransactionAmount = initialSupply_ / 100;
        maxWalletAmount = initialSupply_ / 50;

        isFeeExempt[address(this)] = true;
        isFeeExempt[feeReceiver_] = true;
        if (settingFlag_ & FLAG_EXEMPT_OWNER != 0) {
            isFeeExempt[owner_] = true;
        }

        if (initialSupply_ > 0) {
            _mint(owner_, initialSupply_);
        }
        _transferOwnership(owner_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /// @notice Sum of all configured fees, in basis points.
    function totalFeeBps() public view returns (uint256) {
        return liquidityFeeBps + marketingFeeBps + rewardFeeBps + burnFeeBps;
    }

    /// @notice True when `flag` (a FLAG_* constant) is enabled on this token.
    function hasFlag(uint256 flag) public view returns (bool) {
        return settingFlag & flag != 0;
    }

    /// @notice Exempt or un-exempt an address from transfer fees.
    function setFeeExempt(address account, bool exempt) external onlyOwner {
        require(account != address(0), "Token: zero account");
        isFeeExempt[account] = exempt;
        emit FeeExemptionUpdated(account, exempt);
    }

    /**
     * @notice Raise the transfer and wallet caps.
     * @dev Limits may only ever be relaxed, never tightened, so an owner
     *      cannot trap holders by dropping the cap to zero after launch.
     */
    function setLimits(uint256 maxTransactionAmount_, uint256 maxWalletAmount_)
        external
        onlyOwner
    {
        require(
            maxTransactionAmount_ >= maxTransactionAmount,
            "Token: cannot tighten tx limit"
        );
        require(
            maxWalletAmount_ >= maxWalletAmount,
            "Token: cannot tighten wallet limit"
        );
        maxTransactionAmount = maxTransactionAmount_;
        maxWalletAmount = maxWalletAmount_;
        emit LimitsUpdated(maxTransactionAmount_, maxWalletAmount_);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        if (!canMint) revert CapabilityDisabled("mint");
        _mint(to, amount);
    }

    function pause() external onlyOwner {
        if (!canPause) revert CapabilityDisabled("pause");
        _pause();
    }

    function unpause() external onlyOwner {
        if (!canPause) revert CapabilityDisabled("pause");
        _unpause();
    }

    function setBlacklisted(address account, bool blacklisted) external onlyOwner {
        if (!canBlacklist) revert CapabilityDisabled("blacklist");
        require(account != address(0), "Token: zero account");
        isBlacklisted[account] = blacklisted;
        emit BlacklistUpdated(account, blacklisted);
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
     * @notice Fee-inclusive quote: what `to` actually receives if `from`
     *         sends `amount` right now.
     * @dev The UI calls this before a transfer so the amount shown to the
     *      user matches the amount that lands, rather than recomputing the
     *      tax rules in JavaScript and drifting out of sync with the contract.
     */
    function quoteTransfer(address from, address to, uint256 amount)
        external
        view
        returns (uint256 received, uint256 fee)
    {
        if (_isExempt(from, to)) {
            return (amount, 0);
        }
        fee = (amount * totalFeeBps()) / BPS_DENOMINATOR;
        received = amount - fee;
    }

    function _isExempt(address from, address to) internal view returns (bool) {
        return
            isFeeExempt[from] ||
            isFeeExempt[to] ||
            from == address(0) ||
            to == address(0);
    }

    /**
     * @dev Splits a taxed transfer into its recipient share and fee shares.
     *      Mints and burns (`from`/`to` == address(0)) are never taxed, which
     *      is what `_isExempt` checks first.
     */
    function _transfer(address from, address to, uint256 amount)
        internal
        virtual
        override
    {
        if (_isExempt(from, to) || totalFeeBps() == 0) {
            super._transfer(from, to, amount);
            return;
        }

        _enforceLimits(to, amount);

        uint256 liquidityAmount = (amount * liquidityFeeBps) / BPS_DENOMINATOR;
        uint256 marketingAmount = (amount * marketingFeeBps) / BPS_DENOMINATOR;
        uint256 rewardAmount = (amount * rewardFeeBps) / BPS_DENOMINATOR;
        uint256 burnAmount = (amount * burnFeeBps) / BPS_DENOMINATOR;

        uint256 totalFee = liquidityAmount + marketingAmount + rewardAmount + burnAmount;
        uint256 sendAmount = amount - totalFee;

        if (liquidityAmount + marketingAmount > 0) {
            super._transfer(from, feeReceiver, liquidityAmount + marketingAmount);
        }
        // The reward pool accrues on the token contract itself and is
        // distributed by the owner; holding it here keeps it out of the
        // circulating balance of any single wallet.
        if (rewardAmount > 0) {
            super._transfer(from, address(this), rewardAmount);
        }
        if (burnAmount > 0) {
            if (hasFlag(FLAG_AUTO_BURN)) {
                _burn(from, burnAmount);
            } else {
                super._transfer(from, address(this), burnAmount);
            }
        }

        super._transfer(from, to, sendAmount);

        emit FeesCollected(
            from,
            liquidityAmount,
            marketingAmount,
            rewardAmount,
            burnAmount
        );
    }

    function _enforceLimits(address to, uint256 amount) internal view {
        if (hasFlag(FLAG_MAX_TX_LIMIT) && amount > maxTransactionAmount) {
            revert ExceedsMaxTransaction(amount, maxTransactionAmount);
        }
        if (hasFlag(FLAG_MAX_WALLET_LIMIT)) {
            uint256 balanceAfter = balanceOf(to) + amount;
            if (balanceAfter > maxWalletAmount) {
                revert ExceedsMaxWallet(balanceAfter, maxWalletAmount);
            }
        }
    }

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
