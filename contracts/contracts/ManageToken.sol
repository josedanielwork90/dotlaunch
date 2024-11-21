// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./tokens/ManagedStandardToken.sol";
import "./tokens/ManagedLiquidityToken.sol";

/**
 * @title ManageToken
 * @notice The token factory behind the "Create Token" screen. Deploys either
 *         a plain ERC20 or a fee-on-transfer liquidity token, charges a
 *         creation fee, and records what each address has deployed so the
 *         "Manage Tokens" screen can list a user's tokens without an indexer.
 *
 * @dev The fee is assembled from a base price for the token type plus a
 *      surcharge per optional capability, so a bare token is cheap and a
 *      token with mint + pause + blacklist costs more. `fee()` returns the
 *      whole schedule in one call, which lets the UI price a configuration
 *      client-side and only hit the chain once the user commits.
 *
 *      Overpayment is refunded rather than kept: users routinely send a round
 *      number, and silently pocketing the difference is the kind of detail
 *      that erodes trust in a launchpad.
 *
 *      Function and event names below intentionally preserve the spellings of
 *      the deployed ABI (`createLiuidity`, `createLiquditySuccess`,
 *      `setOwnerSucess`) so existing clients keep working.
 */
contract ManageToken is ReentrancyGuard {
    /// @notice The fee schedule, all values in wei.
    struct FeeSchedule {
        uint256 normal;    // base fee for a standard token
        uint256 mint;      // surcharge: mintable
        uint256 burn;      // surcharge: burnable
        uint256 pause;     // surcharge: pausable
        uint256 blacklist; // surcharge: blacklist
        uint256 deflation; // base fee for a liquidity (fee-on-transfer) token
    }

    FeeSchedule private _fee;

    /// @notice Address permitted to change fees and withdraw proceeds.
    address public owner;

    /// @notice Tokens deployed by each creator, in creation order.
    mapping(address => address[]) private _createdTokens;

    /// @notice True for any address this factory deployed.
    mapping(address => bool) public isFactoryToken;

    /// @notice Every token this factory has deployed, in creation order.
    address[] private _allTokens;

    event CreateStandardSuccess(address);
    event createLiquditySuccess(address);
    event InitFeeSuccess();
    event OwnerWithdrawSuccess(uint256 value);
    event setOwnerSucess(address);

    modifier onlyOwner() {
        require(msg.sender == owner, "ManageToken: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ── Fees ──────────────────────────────────────────────────────────────

    /// @notice The full creation fee schedule.
    function fee()
        external
        view
        returns (
            uint256 normal,
            uint256 mint,
            uint256 burn,
            uint256 pause,
            uint256 blacklist,
            uint256 deflation
        )
    {
        FeeSchedule memory f = _fee;
        return (f.normal, f.mint, f.burn, f.pause, f.blacklist, f.deflation);
    }

    /// @notice Replace the entire fee schedule.
    function initFee(
        uint256 normal,
        uint256 mint,
        uint256 burn,
        uint256 pause,
        uint256 blacklist,
        uint256 deflation
    ) external onlyOwner {
        _fee = FeeSchedule(normal, mint, burn, pause, blacklist, deflation);
        emit InitFeeSuccess();
    }

    /**
     * @notice Price a token configuration without deploying it.
     * @param isLiquidityToken True to price a fee-on-transfer token.
     * @param capabilities [canMint, canBurn, canPause, canBlacklist] as 0/1.
     * @return total The required msg.value, in wei.
     */
    function quoteCreationFee(bool isLiquidityToken, uint256[4] memory capabilities)
        public
        view
        returns (uint256 total)
    {
        FeeSchedule memory f = _fee;
        total = isLiquidityToken ? f.deflation : f.normal;
        if (capabilities[0] != 0) total += f.mint;
        if (capabilities[1] != 0) total += f.burn;
        if (capabilities[2] != 0) total += f.pause;
        if (capabilities[3] != 0) total += f.blacklist;
    }

    // ── Creation ──────────────────────────────────────────────────────────

    /**
     * @notice Deploy a standard ERC20 owned by `creator_`.
     * @dev `_canmint`/`_canburn`/`_canpause`/`_canBlacklist` are 0/1 flags,
     *      kept as uint256 to match the deployed ABI.
     */
    function createStandard(
        address creator_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 tokenSupply_,
        uint256 _canmint,
        uint256 _canburn,
        uint256 _canpause,
        uint256 _canBlacklist
    ) external payable nonReentrant returns (address) {
        require(creator_ != address(0), "ManageToken: zero creator");
        require(tokenSupply_ > 0, "ManageToken: zero supply");

        uint256[4] memory caps = [_canmint, _canburn, _canpause, _canBlacklist];
        uint256 required = quoteCreationFee(false, caps);
        require(msg.value >= required, "ManageToken: insufficient fee");

        ManagedStandardToken token = new ManagedStandardToken(
            name_,
            symbol_,
            decimals_,
            tokenSupply_,
            creator_,
            _toBoolCaps(caps)
        );

        _record(creator_, address(token));
        _refundExcess(required);

        emit CreateStandardSuccess(address(token));
        return address(token);
    }

    /**
     * @notice Deploy a fee-on-transfer token owned by `creator_`.
     * @param reciever Wallet receiving the liquidity and marketing shares.
     * @param settingflag Bitmask of ManagedLiquidityToken.FLAG_* constants.
     * @param fees [liquidity, marketing, reward, burn] in basis points.
     */
    function createLiuidity(
        address creator_,
        address reciever,
        string memory name_,
        string memory symbol_,
        uint8 decimal_,
        uint256 supply,
        uint256 settingflag,
        uint256[4] memory fees,
        uint256 _canmint,
        uint256 _canburn,
        uint256 _canpause,
        uint256 _canBlacklist
    ) external payable nonReentrant returns (address) {
        require(creator_ != address(0), "ManageToken: zero creator");
        require(reciever != address(0), "ManageToken: zero receiver");
        require(supply > 0, "ManageToken: zero supply");

        uint256[4] memory caps = [_canmint, _canburn, _canpause, _canBlacklist];
        uint256 required = quoteCreationFee(true, caps);
        require(msg.value >= required, "ManageToken: insufficient fee");

        ManagedLiquidityToken token = new ManagedLiquidityToken(
            name_,
            symbol_,
            decimal_,
            supply,
            creator_,
            reciever,
            fees,
            settingflag,
            _toBoolCaps(caps)
        );

        _record(creator_, address(token));
        _refundExcess(required);

        emit createLiquditySuccess(address(token));
        return address(token);
    }

    // ── Views ─────────────────────────────────────────────────────────────

    /// @notice Tokens deployed by `creater`, oldest first.
    function getCreatedToken(address creater) external view returns (address[] memory) {
        return _createdTokens[creater];
    }

    /// @notice How many tokens `creater` has deployed.
    function createdTokenCount(address creater) external view returns (uint256) {
        return _createdTokens[creater].length;
    }

    /// @notice Total tokens deployed through this factory.
    function totalTokenCount() external view returns (uint256) {
        return _allTokens.length;
    }

    /**
     * @notice A page of every token the factory has deployed.
     * @dev Bounds are clamped rather than reverting, so a UI paging past the
     *      end gets an empty array instead of a failed call.
     */
    function allTokens(uint256 start, uint256 end)
        external
        view
        returns (address[] memory page)
    {
        uint256 length = _allTokens.length;
        if (start >= length) return new address[](0);
        if (end >= length) end = length - 1;

        uint256 size = end - start + 1;
        page = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            page[i] = _allTokens[start + i];
        }
    }

    /// @notice Fees accumulated in this contract, in wei.
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ── Administration ────────────────────────────────────────────────────

    /// @notice Withdraw accumulated fees to the owner.
    function ownerWithdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "ManageToken: nothing to withdraw");

        (bool sent, ) = payable(owner).call{value: balance}("");
        require(sent, "ManageToken: withdraw failed");

        emit OwnerWithdrawSuccess(balance);
    }

    /// @notice Hand ownership to `newowner`.
    function setOwner(address newowner) external onlyOwner {
        require(newowner != address(0), "ManageToken: zero owner");
        owner = newowner;
        emit setOwnerSucess(newowner);
    }

    // ── Internals ─────────────────────────────────────────────────────────

    function _record(address creator_, address token) private {
        _createdTokens[creator_].push(token);
        _allTokens.push(token);
        isFactoryToken[token] = true;
    }

    /// @dev Return anything paid above the required fee to the caller.
    function _refundExcess(uint256 required) private {
        uint256 excess = msg.value - required;
        if (excess > 0) {
            (bool sent, ) = payable(msg.sender).call{value: excess}("");
            require(sent, "ManageToken: refund failed");
        }
    }

    function _toBoolCaps(uint256[4] memory caps) private pure returns (bool[4] memory) {
        return [caps[0] != 0, caps[1] != 0, caps[2] != 0, caps[3] != 0];
    }
}
