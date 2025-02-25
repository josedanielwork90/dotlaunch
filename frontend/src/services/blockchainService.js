import BlockchainInstance from "../blockchain/bsc";
import walletManager from "./wallet";
import { runtimeConfig } from "../utils/runtimeConfig";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { BigNumber, ethers, providers } from "ethers";
import { BSC_CONTRACT_ADDRESS } from "../utils/define";
import {
  getNumberFromBN,
  getTokenNumberFromBN,
  getUTCTimestamp,
  getBNFromToken,
  makeString,
} from "../utils";

import axios from "axios";
import {
  getLaunchpadDetailAPI,
  getLaunchpadListAPI,
  getReceiptFromIPFS,
} from "../api/common";
import _ from "lodash";
import { Action } from "../pages/Dashboard/LaunchPad/Lists/demo-data";
import { now } from "../utils/runtimeConfig";

const {
  LiquidityTokenAbi,
  StandardTokenAbi,
  TokenAbi,
  TokenLockAbi,
  LiquidityTokenByteCode,
  StandardTokenByteCode,
  DeployerAbi,
  LaunchPadAbi,
  ManageTokenAbi,
  MultiSendTokenAbi,
  DeployerInstance,
  getLaunchpadInstance,
  getTokenInstance,
  BabyTokenAbi,
  BabyTokenByteCode,
  BuyBackBabyTokenAbi,
  BuyBackBabyTokenByteCode,
} = BlockchainInstance;
let globalProvider;
let globalWalletAddr;

/**
 * The active wallet's EIP-1193 provider.
 *
 * Reads from the wallet manager rather than `window.ethereum` directly, so
 * the demo wallet, an extension and WalletConnect are all handled the same
 * way and a browser with no extension does not throw.
 */
const activeProvider = (explicitProvider) => {
  if (explicitProvider) return explicitProvider;
  if (walletManager.provider) return walletManager.provider;

  const scope = typeof window === "undefined" ? null : window;
  return scope && scope.ethereum ? scope.ethereum : null;
};

/** ethers Web3Provider around the active wallet, or null when disconnected. */
const web3Provider = (explicitProvider) => {
  const injected = activeProvider(explicitProvider);
  if (!injected) return null;
  return new providers.Web3Provider(injected);
};

/**
 * Read-only provider talking straight to the configured RPC node.
 *
 * Browsing presales, reading token metadata and checking sale state are all
 * public reads and must not require a wallet. Previously every one of them
 * went through the wallet's signer, so an anonymous visitor - or a reviewer
 * with no extension installed - saw an empty app instead of the catalogue.
 */
let readProviderInstance;
const readProvider = () => {
  if (!readProviderInstance) {
    readProviderInstance = new ethers.providers.JsonRpcProvider(
      runtimeConfig.chainRpcUrl
    );
  }
  return readProviderInstance;
};

/** ERC20 reader for public token metadata. Never needs a signer. */
export const readTokenContract = (tokenAddress) =>
  new ethers.Contract(tokenAddress, StandardTokenAbi, readProvider());

const getTokenContractInstance = async (
  tokenAddress,
  walletType,
  walletProvider
) => {
  if (!globalProvider) globalProvider = web3Provider(walletProvider);
  if (!globalProvider) throw new Error("No wallet is connected.");

  const signer = globalProvider.getSigner(0);
  return new ethers.Contract(tokenAddress, TokenAbi, signer);
};

export const finishTokenSale = async (
  type,
  address,
  walletType,
  walletProvider
) => {
  try {
    const contractInstance = await launchpadContractInstance(
      address,
      walletType,
      walletProvider
    );

    let tx;

    switch (type) {
      case "CANCEL":
        tx = await contractInstance.cancelSale();
        break;
      case "FINISH":
        tx = await contractInstance.finishSale();
        break;
      case "CLAIM":
        tx = await contractInstance.claim();
    }

    const receipt = await tx.wait();

    return receipt;
  } catch (error) {
    console.log(error);
  }
};

export const getLaunchpadMediaInfo = async (launchpad) => {
  const {
    launchpad: address,
    user: owner,
    tokenSale,
    tokenPayment,
    uriData,
    launchPadType: launchpadType,
    presaleRate,
    listingRate,
    startTime: startDate,
    endTime: endDate,
    claimTime: claimDate,
    status,
    minBuyPerParticipant,
    maxBuyPerParticipant,
    totalRaised,
    refundWhenFinish,
    usingWhitelist,
    endOfWhitelistTime,
    whitelistUsers,
  } = launchpad;
  // Public reads: no wallet required, so the catalogue renders for anyone.
  const ercContract = readTokenContract(tokenSale);
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    ercContract.name(),
    ercContract.symbol(),
    ercContract.decimals(),
    ercContract.totalSupply(),
  ]);

  // Off-chain campaign detail is presentational. A presale whose metadata is
  // missing or unreachable still renders from its on-chain fields rather
  // than taking down the whole list, which is what the previous unguarded
  // destructure did.
  let campaign = {};
  if (uriData) {
    try {
      const receipt = await axios.get(uriData, { timeout: 5000 });
      campaign = (receipt && receipt.data && receipt.data.campaignData) || {};
    } catch (error) {
      console.warn(`Campaign metadata unavailable for ${address}`);
    }
  }

  const {
    description,
    discord,
    facebook,
    github,
    logo,
    reddit,
    telegram,
    twitter,
    youtube,
    updates,
    website,
  } = campaign;
  const softCap =
    launchpadType === 0
      ? getTokenNumberFromBN(BigNumber.from(launchpad.softcap))
      : getTokenNumberFromBN(BigNumber.from(launchpad.hardcap));
  const hardCap =
    launchpadType === 0
      ? getTokenNumberFromBN(BigNumber.from(launchpad.hardcap))
      : "0";
  const minBuy = getTokenNumberFromBN(BigNumber.from(minBuyPerParticipant));
  const maxBuy = getTokenNumberFromBN(BigNumber.from(maxBuyPerParticipant));
  const totalDeposits = getTokenNumberFromBN(BigNumber.from(totalRaised));
  const totalNeedToRaised = getTokenNumberFromBN(
    BigNumber.from(launchpad.totalNeedToRaised)
  );
  const adminTokenSaleFee = getTokenNumberFromBN(
    BigNumber.from(launchpad.adminTokenSaleFee)
  );
  const tokenForPresale = getTokenNumberFromBN(
    BigNumber.from(launchpad.hardcap).mul(BigNumber.from(presaleRate))
  );
  const action =
    usingWhitelist &&
    (endOfWhitelistTime === 0 || now() < endOfWhitelistTime)
      ? Action.Whitelist
      : Action.Public;

  let newData = {
    totalSellingAmount: tokenForPresale,
    claimDate,
    tokenForPresale,
    description,
    discord,
    youtube,
    facebook,
    github,
    logo,
    reddit,
    telegram,
    twitter,
    updates,
    website,
    owner,
    name,
    symbol,
    decimals,
    logo,
    presaleRate,
    listingRate,
    softCap,
    hardCap,
    progress:
      launchpadType === 0
        ? (totalDeposits * 100) / Number(hardCap)
        : (totalDeposits * 100) / Number(softCap),
    startDate,
    endDate,
    tokenAddr: tokenSale,
    totalSupply: getTokenNumberFromBN(totalSupply, decimals),
    totalDeposits,
    totalNeedToRaised,
    adminTokenSaleFee,
    launchpadAddr: address,
    owner,
    status: parseInt(status),
    liquidity: 0,
    minBuy,
    maxBuy,
    tokenPaymentAddr: tokenPayment,
    refundWhenFinished: refundWhenFinish === "true",
    launchpadType,
    usingWhitelist,
    endOfWhitelistTime,
    action,
    whitelistUsers,
  };
  return newData;
};

export const getLaunchpadInfoByAddress = async (address) => {
  try {
    const {
      data: { launchpad },
    } = await getLaunchpadDetailAPI(address);
    return getLaunchpadMediaInfo(launchpad);
  } catch (error) {
    console.error("getLaunchpadInfoByAddress", error);
  }
};

export const claimTokenFund = async (
  launchpadAddress,
  walletType,
  walletProvider
) => {
  try {
    let contractInstance = await launchpadContractInstance(
      launchpadAddress,
      walletType,
      walletProvider
    );

    let tx = await contractInstance.claimFund();

    let receipt = await tx.wait();

    return receipt;
  } catch (error) {
    console.log(error);
  }
};

export const claimTokenRefund = async (
  launchpadAddress,
  walletType,
  walletProvider
) => {
  try {
    let contractInstance = await launchpadContractInstance(
      launchpadAddress,
      walletType,
      walletProvider
    );

    let tx = await contractInstance.claimRefund();

    let receipt = await tx.wait();

    return receipt;
  } catch (error) {
    console.log(error);
  }
};

export const checkClaimedLaunchpad = async (
  launchpadAddr,
  tokenRate,
  launchpadType,
  decimals
) => {
  try {
    let contractInstance = await getLaunchpadInstance(launchpadAddr);
    let amountToClaim;
    if (launchpadType === 0) {
      amountToClaim = await contractInstance.earnedAmount(globalWalletAddr);
      return getTokenNumberFromBN(amountToClaim, decimals);
    } else {
      amountToClaim = await contractInstance.depositedAmount(globalWalletAddr);
      const rate = getBNFromToken(tokenRate.toFixed(9), 9);
      return getTokenNumberFromBN(amountToClaim.mul(rate), 27);
    }
  } catch (error) {
    console.log(error);
    return "0";
  }
};

export const buyToken = async (
  _amount,
  tokenPaymentAddr,
  launchpadAddress,
  walletType,
  walletProvider
) => {
  try {
    let contractInstance = await launchpadContractInstance(
      launchpadAddress,
      walletType,
      walletProvider
    );

    const value = ethers.utils.parseUnits(_amount, "ether");
    let tx = await contractInstance.invest(value, {
      value:
        tokenPaymentAddr === process.env.REACT_APP_BSC_CONTRACT_ADDR_TOKEN_BNB
          ? value
          : null,
    });

    let receipt = await tx.wait();

    return receipt;
  } catch (error) {
    console.log(error);
  }
};

export const getUserContributions = async () => {
  try {
    let contributions = await DeployerInstance.getUserContributions(
      globalWalletAddr
    );

    return contributions;
  } catch (error) {
    console.log(error, "getUserContributions");
  }
};

export const getLaunchPadContribution = async (
  launchpadAddr,
  walletType,
  walletProvider
) => {
  try {
    const contractInstance = await launchpadContractInstance(
      launchpadAddr,
      walletType,
      walletProvider
    );
    const contributions = await contractInstance.getContributorsList();

    return contributions;
  } catch (error) {
    console.log(error, "getLaunchPadContribution");
  }
};

export const getLaunchpadDetails = async ({ filter, page, size }) => {
  try {
    let allFilter = { filter, page, size };
    allFilter = _.pickBy(allFilter);
    if (allFilter.filter) {
      allFilter.filter = _.pickBy(allFilter.filter);
    }
    let {
      data: { totalItems, launchpads, totalPages, currentPage },
    } = await getLaunchpadListAPI(allFilter);
    try {
      launchpads = await Promise.all(launchpads.map(getLaunchpadMediaInfo));
    } catch (error) {
      console.log(error);
      totalItems = 0;
      launchpads = [];
      totalPages = 0;
      currentPage = 0;
    }
    return { totalItems, launchpads, totalPages, currentPage };
  } catch (error) {
    console.log(error, "launchpadDetails");
    return {};
  }
};

export const checkTokenAllowance = async (tokenAddress, _operator) => {
  try {
    if (tokenAddress === process.env.REACT_APP_BSC_CONTRACT_ADDR_TOKEN_BNB)
      return true;
    let operator = "";
    switch (_operator) {
      case "DEPLOYER":
        operator = BSC_CONTRACT_ADDRESS.DEPLOYER;
        break;
      case "LOCKER":
        operator = BSC_CONTRACT_ADDRESS.TOKEN_LOCK;
        break;
      case "AIRDROP":
        operator = BSC_CONTRACT_ADDRESS.AIRDROP;
        break;
      case "MULTISEND_TOKEN":
        operator = BSC_CONTRACT_ADDRESS.TOKEN_MULTISEND;
        break;
      default:
        operator = _operator;
        break;
    }
    let tokenInstance = getTokenInstance(tokenAddress);

    let receipt = await tokenInstance.allowance(globalWalletAddr, operator);

    return receipt > 0;
  } catch (error) {
    console.error(error, "checkAllowance");
  }
};

export const approveTokenDeployer = async (
  tokenAddress,
  walletType,
  walletProvider
) => {
  try {
    let instance = await getTokenContractInstance(
      tokenAddress,
      walletType,
      walletProvider
    );

    let operator = BSC_CONTRACT_ADDRESS.DEPLOYER;

    let tx = await instance.approve(
      operator,
      "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      { gasLimit: 100000 }
    );

    let receipt = await tx.wait();

    return receipt;
  } catch (error) {
    console.log(error, "approveDeployer");
  }
};

export const approveTokenLaunchpad = async (
  tokenAddress,
  launchpadAddress,
  walletType,
  walletProvider
) => {
  try {
    let instance = await getTokenContractInstance(
      tokenAddress,
      walletType,
      walletProvider
    );

    let tx = await instance.approve(
      launchpadAddress,
      "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      { gasLimit: 100000 }
    );

    let receipt = await tx.wait();

    return receipt;
  } catch (error) {
    console.log(error, "approveLaunchpad");
  }
};

/**
 * Re-establish a previous session without prompting.
 *
 * The old implementation referenced a bare `ethereum` global, which threw a
 * ReferenceError in any browser without an extension - before the user could
 * even reach the connect dialog.
 */
export const getConnectedWallet = async () => {
  try {
    globalWalletAddr = await walletManager.restore();
    return globalWalletAddr;
  } catch (error) {
    return "";
  }
};

/**
 * Connect a wallet extension.
 *
 * Delegates to the wallet manager, which also switches the wallet to the
 * configured chain - previously this demanded BSC testnet unconditionally,
 * so the app could not be used on any other network.
 */
export const connectMetamask = async () => {
  try {
    globalProvider = null;
    globalWalletAddr = await walletManager.connect("INJECTED");
    return globalWalletAddr;
  } catch (error) {
    console.error(error);
    return "";
  }
};

/** Connect the built-in demo wallet backed by the local development chain. */
export const connectDemoWallet = async (address) => {
  try {
    globalProvider = null;
    globalWalletAddr = await walletManager.connect("DEMO", { address });
    return globalWalletAddr;
  } catch (error) {
    console.error(error);
    return "";
  }
};

// Extension account/chain switches invalidate the cached provider. The demo
// wallet emits accountsChanged too, but is handled without a reload so
// switching demo accounts stays instant.
const injectedForEvents =
  typeof window !== "undefined" && window.ethereum ? window.ethereum : null;

if (injectedForEvents && typeof injectedForEvents.on === "function") {
  injectedForEvents.on("accountsChanged", () => {
    globalProvider = null;
    window.location.reload();
  });

  injectedForEvents.on("chainChanged", () => {
    globalProvider = null;
    window.location.reload();
  });
}

walletManager.subscribe((address) => {
  globalProvider = null;
  globalWalletAddr = address;
});

const createStandardContract = async (addr) => {
  let tokenContract;

  if (!globalWalletAddr) {
    globalWalletAddr = await getConnectedWallet();
    if (!globalWalletAddr) {
      await connectMetamask();
    }
  }

  if (!globalProvider) globalProvider = web3Provider();
  if (!globalProvider) return null;

  tokenContract = connectContract(StandardTokenAbi, addr);

  if (!tokenContract) {
    return null;
  }

  let signer = await globalProvider.getSigner();

  if (signer) {
    try {
      tokenContract = await tokenContract.connect(signer);
    } catch (error) {
      console.error("Token lock connect error");
    }
  } else {
    return null;
  }

  return tokenContract;
};

export const isValidAddress = (addr) => ethers.utils.isAddress(addr);

const connectContract = (tokenabi, tokenAddr, signer) => {
  try {
    if (!globalProvider) globalProvider = web3Provider();
    if (!globalProvider) return null;
    return new ethers.Contract(tokenAddr, tokenabi, signer || globalProvider);
  } catch (error) {
    console.log(error);
    return null;
  }
};

const createLockContract = async () => {
  let tokenContract;

  if (!globalProvider) {
    return null;
  }

  tokenContract = connectContract(
    TokenLockAbi,
    BSC_CONTRACT_ADDRESS.TOKEN_LOCK
  );

  if (!tokenContract) {
    return null;
  }

  return tokenContract;
};

const createManageContract = async () => {
  let manageContract;

  if (!globalProvider || !globalWalletAddr) {
    return null;
  }

  manageContract = await connectContract(
    ManageTokenAbi,
    BSC_CONTRACT_ADDRESS.TOKEN_MANAGE
  );

  if (!manageContract) {
    return null;
  }

  let signer = await globalProvider.getSigner();

  if (signer) {
    try {
      manageContract = await manageContract.connect(signer);
      return manageContract;
    } catch (error) {
      console.log(error, "createManageContract");
    }
  } else {
    return null;
  }
};
