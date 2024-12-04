// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Vesting
 * @notice Linear token vesting with an optional cliff, one schedule per
 *         beneficiary per token.
 *
 * @dev Schedules are funded up front: the contract pulls the whole allocation
 *      at creation time rather than trusting the grantor to still hold the
 *      tokens when the beneficiary comes to claim. A schedule can be revoked
 *      only if it was created as revocable, and revoking still releases
 *      everything vested up to that moment - otherwise the grantor could take
 *      back tokens the beneficiary had already earned.
 */
contract Vesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Schedule {
        address token;
        address beneficiary;
        uint256 total;
        uint256 released;
        uint64 start;
        uint64 cliff;
        uint64 duration;
        bool revocable;
        bool revoked;
    }

    Schedule[] private _schedules;
    mapping(address => uint256[]) private _byBeneficiary;
    mapping(address => uint256[]) private _byGrantor;

    event ScheduleCreated(
        uint256 indexed id,
        address indexed token,
        address indexed beneficiary,
        uint256 total,
        uint64 start,
        uint64 cliff,
        uint64 duration
    );
    event Released(uint256 indexed id, address indexed beneficiary, uint256 amount);
    event Revoked(uint256 indexed id, uint256 refunded);

    error NoSuchSchedule();
    error NothingVested();
    error NotBeneficiary();
    error NotRevocable();
    error AlreadyRevoked();

    modifier validSchedule(uint256 id) {
        if (id >= _schedules.length) revert NoSuchSchedule();
        _;
    }

    /**
     * @notice Create and fund a vesting schedule.
     * @param token       Token being vested.
     * @param beneficiary Who may claim.
     * @param total       Full allocation, pulled from the caller now.
     * @param start       Vesting start, in unix seconds.
     * @param cliffSeconds Seconds after `start` before anything vests.
     * @param duration    Total vesting period in seconds.
     * @param revocable   Whether the grantor may cancel the remainder.
     */
    function create(
        address token,
        address beneficiary,
        uint256 total,
        uint64 start,
        uint64 cliffSeconds,
        uint64 duration,
        bool revocable
    ) external nonReentrant returns (uint256 id) {
        require(token != address(0), "Vesting: zero token");
        require(beneficiary != address(0), "Vesting: zero beneficiary");
        require(total > 0, "Vesting: zero amount");
        require(duration > 0, "Vesting: zero duration");
        require(cliffSeconds <= duration, "Vesting: cliff after end");

        id = _schedules.length;
        _schedules.push(
            Schedule({
                token: token,
                beneficiary: beneficiary,
                total: total,
                released: 0,
                start: start,
                cliff: start + cliffSeconds,
                duration: duration,
                revocable: revocable,
                revoked: false
            })
        );

        _byBeneficiary[beneficiary].push(id);
        _byGrantor[msg.sender].push(id);

        IERC20(token).safeTransferFrom(msg.sender, address(this), total);

        emit ScheduleCreated(
            id,
            token,
            beneficiary,
            total,
            start,
            start + cliffSeconds,
            duration
        );
    }

    /// @notice Amount vested for `id` as of now, released or not.
    function vestedAmount(uint256 id)
        public
        view
        validSchedule(id)
        returns (uint256)
    {
        Schedule storage schedule = _schedules[id];

        if (schedule.revoked) return schedule.total;
        if (block.timestamp < schedule.cliff) return 0;
        if (block.timestamp >= schedule.start + schedule.duration) {
            return schedule.total;
        }

        uint256 elapsed = block.timestamp - schedule.start;
        return (schedule.total * elapsed) / schedule.duration;
    }

    /// @notice Amount claimable right now.
    function releasableAmount(uint256 id) public view returns (uint256) {
        return vestedAmount(id) - _schedules[id].released;
    }

    /// @notice Claim everything vested so far.
    function release(uint256 id) external nonReentrant validSchedule(id) {
        Schedule storage schedule = _schedules[id];
        if (msg.sender != schedule.beneficiary) revert NotBeneficiary();

        uint256 amount = releasableAmount(id);
        if (amount == 0) revert NothingVested();

        schedule.released += amount;
        IERC20(schedule.token).safeTransfer(schedule.beneficiary, amount);

        emit Released(id, schedule.beneficiary, amount);
    }

    /**
     * @notice Cancel the unvested remainder and return it to the grantor.
     * @dev Everything vested at this instant stays claimable by the
     *      beneficiary; only the future portion comes back. The schedule's
     *      total is frozen at the vested amount, which is what keeps
     *      `releasableAmount` correct after the revoke.
     */
    function revoke(uint256 id) external onlyOwner nonReentrant validSchedule(id) {
        Schedule storage schedule = _schedules[id];
        if (!schedule.revocable) revert NotRevocable();
        if (schedule.revoked) revert AlreadyRevoked();

        uint256 vested = vestedAmount(id);
        uint256 refund = schedule.total - vested;

        schedule.revoked = true;
        schedule.total = vested;

        if (refund > 0) {
            IERC20(schedule.token).safeTransfer(owner(), refund);
        }

        emit Revoked(id, refund);
    }

    /// @notice Total number of schedules ever created.
    function scheduleCount() external view returns (uint256) {
        return _schedules.length;
    }

    /// @notice One schedule by id.
    function getSchedule(uint256 id)
        external
        view
        validSchedule(id)
        returns (Schedule memory)
    {
        return _schedules[id];
    }

    /// @notice Every schedule id granted to `beneficiary`.
    function schedulesFor(address beneficiary)
        external
        view
        returns (uint256[] memory)
    {
        return _byBeneficiary[beneficiary];
    }

    /// @notice Every schedule id created by `grantor`.
    function schedulesBy(address grantor)
        external
        view
        returns (uint256[] memory)
    {
        return _byGrantor[grantor];
    }
}
