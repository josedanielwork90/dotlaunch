// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title LaunchpadV1
 * @notice A single fixed-price presale, deployed directly by its owner.
 *
 * @dev This is the first cut of the sale mechanism: one contract, one sale,
 *      created by whoever wants to run it. There is no factory, so nothing
 *      indexes sales and the front end has to be told each address by hand.
 *      Payment is in the native coin only.
 */
contract LaunchpadV1 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State {
        OPENING,
        FINISHED,
        CANCELLED
    }

    /// @notice Token being sold.
    IERC20 public immutable tokenSale;

    /// @notice Minimum raise for the sale to count as successful.
    uint256 public immutable softCap;
    /// @notice Maximum the sale will accept.
    uint256 public immutable hardCap;

    /// @notice Sale window, in unix seconds.
    uint256 public immutable startTime;
    uint256 public immutable endTime;

    /// @notice Sale tokens per unit of native coin, scaled by 1e18.
    uint256 public immutable presaleRate;

    /// @notice Per-participant contribution bounds.
    uint256 public immutable minBuyPerParticipant;
    uint256 public immutable maxBuyPerParticipant;

    /// @notice Off-chain metadata URI (logo, description, socials).
    string public uriData;

    State public state;

    uint256 public totalDeposits;
    uint256 public totalOwed;

    mapping(address => uint256) public depositedAmount;
    mapping(address => uint256) public earnedAmount;
    address[] public contributors;

    event Invested(address indexed user, uint256 amount, uint256 tokens);
    event Claimed(address indexed user, uint256 tokens);
    event Refunded(address indexed user, uint256 amount);
    event SaleClosed(uint256 timestamp, uint256 collected);
    event SaleCancelled(uint256 timestamp);

    error SaleNotOpen();
    error OutsideWindow();
    error HardCapReached();
    error BelowMinimum();
    error AboveMaximum();
    error NothingToClaim();
    error SaleNotSettled();

    constructor(
        address _tokenSale,
        uint256[2] memory _caps,
        uint256[2] memory _times,
        uint256 _presaleRate,
        uint256[2] memory _limits,
        string memory _uriData
    ) {
        require(_tokenSale != address(0), "LaunchpadV1: zero token");
        require(_caps[0] > 0 && _caps[1] >= _caps[0], "LaunchpadV1: bad caps");
        require(_times[1] > _times[0], "LaunchpadV1: bad window");
        require(_presaleRate > 0, "LaunchpadV1: bad rate");

        tokenSale = IERC20(_tokenSale);
        softCap = _caps[0];
        hardCap = _caps[1];
        startTime = _times[0];
        endTime = _times[1];
        presaleRate = _presaleRate;
        minBuyPerParticipant = _limits[0];
        maxBuyPerParticipant = _limits[1];
        uriData = _uriData;
        state = State.OPENING;
    }

    /// @notice Contribute to the sale and accrue a token allocation.
    function invest() external payable nonReentrant {
        if (state != State.OPENING) revert SaleNotOpen();
        if (block.timestamp < startTime || block.timestamp > endTime) {
            revert OutsideWindow();
        }
        if (totalDeposits + msg.value > hardCap) revert HardCapReached();

        if (depositedAmount[msg.sender] == 0) {
            contributors.push(msg.sender);
        }

        depositedAmount[msg.sender] += msg.value;
        if (depositedAmount[msg.sender] < minBuyPerParticipant) {
            revert BelowMinimum();
        }
        if (depositedAmount[msg.sender] > maxBuyPerParticipant) {
            revert AboveMaximum();
        }

        uint256 tokens = (msg.value *
            presaleRate *
            10**ERC20(address(tokenSale)).decimals()) / 1e18;

        earnedAmount[msg.sender] += tokens;
        totalOwed += tokens;
        totalDeposits += msg.value;

        emit Invested(msg.sender, msg.value, tokens);
    }

    /// @notice Close a sale that has reached its soft cap.
    function closeSale() external onlyOwner {
        if (state != State.OPENING) revert SaleNotOpen();
        require(block.timestamp > endTime, "LaunchpadV1: still open");
        require(totalDeposits >= softCap, "LaunchpadV1: soft cap not reached");

        state = State.FINISHED;
        payable(owner()).transfer(totalDeposits);

        emit SaleClosed(block.timestamp, totalDeposits);
    }

    /// @notice Cancel the sale, releasing every contributor to a refund.
    function cancelSale() external onlyOwner {
        if (state != State.OPENING) revert SaleNotOpen();

        state = State.CANCELLED;
        emit SaleCancelled(block.timestamp);
    }

    /// @notice Collect the tokens bought in a successful sale.
    function claim() external nonReentrant {
        if (state != State.FINISHED) revert SaleNotSettled();

        uint256 owed = earnedAmount[msg.sender];
        if (owed == 0) revert NothingToClaim();

        earnedAmount[msg.sender] = 0;
        totalOwed -= owed;
        tokenSale.safeTransfer(msg.sender, owed);

        emit Claimed(msg.sender, owed);
    }

    /// @notice Take back a contribution to a cancelled sale.
    function refund() external nonReentrant {
        if (state != State.CANCELLED) revert SaleNotSettled();

        uint256 deposited = depositedAmount[msg.sender];
        if (deposited == 0) revert NothingToClaim();

        depositedAmount[msg.sender] = 0;
        earnedAmount[msg.sender] = 0;
        payable(msg.sender).transfer(deposited);

        emit Refunded(msg.sender, deposited);
    }

    /// @notice Number of distinct contributors.
    function contributorCount() external view returns (uint256) {
        return contributors.length;
    }

    /// @notice Whether the sale is currently accepting contributions.
    function isLive() external view returns (bool) {
        return
            state == State.OPENING &&
            block.timestamp >= startTime &&
            block.timestamp <= endTime;
    }
}
