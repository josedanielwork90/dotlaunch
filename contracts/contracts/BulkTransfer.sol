// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title BulkTransfer
 * @notice Distributes an ERC20 token to many recipients in a single
 *         transaction, which is how the multisend screen pays out airdrops,
 *         team allocations and presale refunds.
 *
 * @dev Tokens are pulled from the caller with `transferFrom`, so the caller
 *      must approve this contract for the sum of all allocations first. The
 *      contract deliberately holds no balance of its own: every transfer is
 *      caller -> recipient, and a failure anywhere reverts the whole batch.
 *      That all-or-nothing property is what lets the UI treat a batch as a
 *      single unit of work rather than reconciling partial success.
 */
contract BulkTransfer is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice A single recipient/amount pair within a batch.
    struct TransferSettings {
        address receiver;
        uint256 amount;
    }

    /// @notice Upper bound on batch size, to keep a call within the block gas limit.
    uint256 public constant MAX_BATCH_SIZE = 400;

    event BulkTransferExecuted(
        address indexed sender,
        address indexed token,
        uint256 recipientCount,
        uint256 totalAmount
    );

    /**
     * @notice Transfer `settings[i].amount` of `token` to `settings[i].receiver`
     *         for every entry, atomically.
     * @param settings Recipient/amount pairs. Must be non-empty and within
     *                 MAX_BATCH_SIZE. Zero addresses and zero amounts are
     *                 rejected so a malformed CSV fails loudly rather than
     *                 silently burning tokens.
     * @param token    The ERC20 being distributed.
     */
    function bulkTransfer(TransferSettings[] calldata settings, IERC20 token)
        external
        nonReentrant
    {
        uint256 count = settings.length;
        require(count > 0, "BulkTransfer: empty batch");
        require(count <= MAX_BATCH_SIZE, "BulkTransfer: batch too large");
        require(address(token) != address(0), "BulkTransfer: zero token");

        uint256 total;
        for (uint256 i = 0; i < count; i++) {
            TransferSettings calldata entry = settings[i];
            require(entry.receiver != address(0), "BulkTransfer: zero receiver");
            require(entry.amount > 0, "BulkTransfer: zero amount");

            total += entry.amount;
            token.safeTransferFrom(msg.sender, entry.receiver, entry.amount);
        }

        emit BulkTransferExecuted(msg.sender, address(token), count, total);
    }

    /**
     * @notice Sum the amounts in a batch without sending anything.
     * @dev Used by the UI to show the required approval amount before the
     *      user signs, and by tests to assert the approval maths.
     */
    function totalOf(TransferSettings[] calldata settings)
        external
        pure
        returns (uint256 total)
    {
        for (uint256 i = 0; i < settings.length; i++) {
            total += settings[i].amount;
        }
    }
}
