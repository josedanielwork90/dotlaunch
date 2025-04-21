/**
 * Loads the demo environment.
 *
 *   docker compose run --rm seed
 *   npx hardhat run --network localhost scripts/seed-demo-data.js
 *
 * Deploys the demo tokens, creates every presale in the catalogue, funds
 * them from real investor accounts, drives the ones that should be finished
 * or cancelled to that state, and creates the token locks — then leaves the
 * chain clock parked at the exact instant the web app treats as "now".
 *
 * The point is that nothing here is faked. Each sale state a reviewer sees
 * is the genuine result of transactions executed in the right order at the
 * right time, so the contracts, the API's event listener and the UI all
 * agree. Re-running is safe: the script detects an already-seeded chain and
 * stops rather than half-applying a second copy.
 */

const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const {
  DEMO_NOW,
  HISTORY_DAYS,
  DAY,
  ACCOUNTS,
  PRESALES,
  STANDALONE_TOKENS,
  LOCKS,
} = require("./lib/demo-dataset");
const chainTime = require("./lib/chain-time");
const { MetadataClient } = require("./lib/metadata-client");

const LAUNCHPAD_TYPE = { NORMAL: 0, FAIR: 1 };
const ZERO = ethers.constants.AddressZero;

/** Admin fee on the token sale, in basis points (2%). */
const ADMIN_TOKEN_SALE_FEE = 200;
/** Admin fee on raised funds, in basis points (2%). */
const ADMIN_PAYMENT_FEE = 200;

const log = (...args) => console.log(...args);
const step = (title) => log(`\n── ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);

/** Read the addresses written by deploy-all.js. */
const loadDeployment = () => {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No deployment found at ${file}. Run scripts/deploy-all.js first ` +
        `(docker compose up runs it automatically).`
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
};

/**
 * Resolve the dataset's account names to signers.
 *
 * The dataset refers to roles ("founder", "cofounder"); this maps them onto
 * the deterministic HD accounts so the catalogue stays readable.
 */
const resolveAccounts = async () => {
  const signers = await ethers.getSigners();
  const need = Math.max(
    ACCOUNTS.admin,
    ACCOUNTS.founder,
    ACCOUNTS.cofounder,
    ACCOUNTS.locker,
    ...ACCOUNTS.investors
  );
  if (signers.length <= need) {
    throw new Error(
      `Need at least ${need + 1} accounts, chain exposes ${signers.length}. ` +
        `Start anvil with --accounts 20.`
    );
  }

  return {
    admin: signers[ACCOUNTS.admin],
    founder: signers[ACCOUNTS.founder],
    cofounder: signers[ACCOUNTS.cofounder],
    locker: signers[ACCOUNTS.locker],
    investors: ACCOUNTS.investors.map((i) => signers[i]),
    all: signers,
  };
};

/**
 * Deploy a token through the factory.
 *
 * Going through ManageToken rather than deploying directly means the token
 * also shows up on the "Manage Tokens" screen for its owner, which is what a
 * reviewer expects to see after the factory has been used.
 */
const createToken = async (factory, owner, spec) => {
  const capabilities = spec.capabilities || {};
  const caps = [
    capabilities.mint ? 1 : 0,
    capabilities.burn ? 1 : 0,
    capabilities.pause ? 1 : 0,
    capabilities.blacklist ? 1 : 0,
  ];
  const supply = ethers.utils.parseUnits(spec.supply, spec.decimals);
  const isLiquidity = spec.kind === "liquidity";
  const fee = await factory.quoteCreationFee(isLiquidity, caps);

  let receipt;
  if (isLiquidity) {
    const tx = await factory
      .connect(owner)
      .createLiuidity(
        owner.address,
        owner.address,
        spec.name,
        spec.symbol,
        spec.decimals,
        supply,
        // Enforce a max wallet and exempt the owner, so the demo token
        // exercises the limit logic without blocking the seeder itself.
        2 | 4,
        spec.fees,
        ...caps,
        { value: fee }
      );
    receipt = await tx.wait();
  } else {
    const tx = await factory
      .connect(owner)
      .createStandard(
        owner.address,
        spec.name,
        spec.symbol,
        spec.decimals,
        supply,
        ...caps,
        { value: fee }
      );
    receipt = await tx.wait();
  }

  // The factory emits the new address; read it from the receipt rather than
  // guessing at a nonce-derived address.
  const event = receipt.events.find(
    (e) => e.event === "CreateStandardSuccess" || e.event === "createLiquditySuccess"
  );
  if (!event) {
    throw new Error(`Token factory emitted no creation event for ${spec.symbol}`);
  }
  const address = event.args[0];
  log(`  token   ${spec.symbol.padEnd(6)} ${address}  (${spec.name})`);
  return address;
};

/**
 * Tokens the deployer must be allowed to pull for a presale.
 *
 * LaunchpadDeployer moves the sale allocation from the creator into the new
 * launchpad during creation, so the creator has to approve it first.
 */
const approveDeployer = async (token, owner, deployerAddress) => {
  const tx = await token.connect(owner).approve(deployerAddress, ethers.constants.MaxUint256);
  await tx.wait();
};

/** Create one presale and return its address. */
const createPresale = async (deployer, owner, spec, tokenAddress, uri) => {
  const caps = [
    ethers.utils.parseEther(spec.softCap),
    ethers.utils.parseEther(spec.hardCap),
  ];
  const times = [
    Math.floor(DEMO_NOW + spec.startOffsetDays * DAY),
    Math.floor(DEMO_NOW + spec.endOffsetDays * DAY),
    Math.floor(DEMO_NOW + spec.saleEndOffsetDays * DAY),
  ];
  const rates = [spec.presaleRate, spec.listingRate];
  const limits = [
    ethers.utils.parseEther(spec.minBuy),
    ethers.utils.parseEther(spec.maxBuy),
  ];
  const adminFees = [ADMIN_TOKEN_SALE_FEE, ADMIN_PAYMENT_FEE];
  const tokens = [tokenAddress, spec.payment === "native" ? ZERO : spec.payment];

  const deployCost = await deployer.deployCost();
  const tx = await deployer
    .connect(owner)
    .createLaunchpad(
      caps,
      times,
      rates,
      limits,
      adminFees,
      tokens,
      uri,
      true,
      LAUNCHPAD_TYPE[spec.type],
      { value: deployCost }
    );
  const receipt = await tx.wait();

  const event = receipt.events.find((e) => e.event === "launchpadDeployed");
  if (!event) {
    throw new Error(`No launchpadDeployed event for ${spec.symbol}`);
  }
  return event.args.launchpad;
};

/** Contribute to a presale from the investor accounts. */
const fundPresale = async (launchpad, investors, amounts) => {
  let total = ethers.BigNumber.from(0);

  for (let i = 0; i < amounts.length; i++) {
    const investor = investors[i % investors.length];
    const value = ethers.utils.parseEther(amounts[i]);
    const tx = await launchpad.connect(investor).invest(value, { value });
    await tx.wait();
    total = total.add(value);
  }

  return total;
};

/**
 * Seed one presale end to end.
 *
 * Handles the clock: past sales are created and funded while the chain is
 * still in the past, then driven to their terminal state before the clock
 * moves on.
 */
const seedPresale = async (context, spec) => {
  const { deployer, factory, accounts, metadata, deployment } = context;
  const owner = accounts[spec.owner];

  // Create at whatever the clock currently reads. Deliberately no time
  // travel here: presales are processed in start order, so the clock is
  // always at or before this sale's window, and advancing it to meet a
  // *future* sale would push the chain past DEMO_NOW - leaving the app's
  // frozen "now" behind the chain and every countdown wrong.
  const tokenAddress = await createToken(factory, owner, {
    ...spec,
    kind: "standard",
    capabilities: { mint: false, burn: true, pause: false, blacklist: false },
  });

  const token = await ethers.getContractAt("ManagedStandardToken", tokenAddress);
  await approveDeployer(token, owner, deployment.contracts.launchpadDeployer);

  const { uri, stored, error: metadataError } = await metadata.put(
    spec.key,
    { name: spec.name, symbol: spec.symbol, ...spec.metadata },
    owner
  );
  if (!stored && metadataError) {
    log(`          ! metadata not published: ${metadataError}`);
  }

  const launchpadAddress = await createPresale(deployer, owner, spec, tokenAddress, uri);
  const launchpad = await ethers.getContractAt("LaunchPad", launchpadAddress);
  log(`  sale    ${spec.symbol.padEnd(6)} ${launchpadAddress}  [${spec.state}]${stored ? "" : "  (metadata offline)"}`);

  if (spec.state === "whitelist") {
    const granted = accounts.investors
      .slice(0, spec.whitelistCount)
      .map((s) => s.address);
    await (await launchpad.connect(owner).enableWhitelist()).wait();
    await (await launchpad.connect(owner).grantWhitelist(granted)).wait();
    log(`          whitelist enabled for ${granted.length} addresses`);
  }

  // Move into the sale window before contributing.
  if (spec.contributions.length > 0) {
    const startAt = Math.floor(DEMO_NOW + spec.startOffsetDays * DAY);
    await chainTime.travelTo(startAt + 60);

    const investors =
      spec.state === "whitelist"
        ? accounts.investors.slice(0, spec.whitelistCount)
        : accounts.investors;

    const total = await fundPresale(launchpad, investors, spec.contributions);
    log(`          raised ${ethers.utils.formatEther(total)} ETH from ${spec.contributions.length} contributions`);
  }

  // Terminal states are reached by the owner acting after the window closes.
  if (spec.state === "cancelled") {
    await (await launchpad.connect(owner).cancelSale()).wait();
    log("          sale cancelled by owner");
  }

  if (spec.state === "finalised") {
    const endAt = Math.floor(DEMO_NOW + spec.saleEndOffsetDays * DAY);
    await chainTime.travelTo(endAt + 60);
    try {
      await (await launchpad.connect(owner).finishSale()).wait();
      log("          sale finished by owner");
    } catch (error) {
      // finishSale enforces its own preconditions; if the dataset drifts out
      // of step with them, say so rather than silently shipping a sale in
      // the wrong state.
      log(`          ! could not finish sale: ${error.reason || error.message}`);
    }
  }

  if (spec.state === "failed") {
    // Nothing to do: the window simply closes below softcap. Move past it so
    // the UI derives "failed" from the on-chain numbers.
    const endAt = Math.floor(DEMO_NOW + spec.endOffsetDays * DAY);
    await chainTime.travelTo(endAt + 60);
    log("          sale closed below softcap");
  }

  return { key: spec.key, token: tokenAddress, launchpad: launchpadAddress, uri };
};

/**
 * Make sure `holder` has at least `amount` of a token, topping them up from
 * the account that minted it.
 *
 * Locks are deliberately spread across several accounts so the lock list is
 * not one address's view, but supply is minted to whoever created the token.
 * Rather than constrain the catalogue to "only lock what you minted", the
 * seeder moves the tokens first - which is what a real user would do.
 */
const ensureBalance = async (token, minter, holder, amount) => {
  if (holder.address === minter.address) return;

  const balance = await token.balanceOf(holder.address);
  if (balance.gte(amount)) return;

  const shortfall = amount.sub(balance);
  await (await token.connect(minter).transfer(holder.address, shortfall)).wait();
};

/** Create the token locks. */
const seedLocks = async (context, tokenAddresses, tokenMinters) => {
  const { locker, accounts } = context;
  const created = [];

  for (const spec of LOCKS) {
    const tokenAddress = tokenAddresses[spec.tokenKey];
    if (!tokenAddress) {
      log(`  ! no token for lock "${spec.label}" (${spec.tokenKey}), skipping`);
      continue;
    }

    const owner = accounts[spec.owner];
    const token = await ethers.getContractAt("ManagedStandardToken", tokenAddress);
    const decimals = await token.decimals();
    const amount = ethers.utils.parseUnits(spec.amount, decimals);

    const minterRole = tokenMinters[spec.tokenKey];
    if (minterRole) {
      await ensureBalance(token, accounts[minterRole], owner, amount);
    }

    await (await token.connect(owner).approve(locker.address, amount)).wait();
    const tx = await locker
      .connect(owner)
      .lock(owner.address, tokenAddress, spec.isLp, amount, spec.unlockAt);
    await tx.wait();

    log(
      `  lock    ${spec.label.padEnd(28)} ${spec.amount.padStart(12)} ` +
        `unlocks ${chainTime.iso(spec.unlockAt).slice(0, 10)}`
    );
    created.push(spec.label);
  }

  return created;
};

/** Refuse to seed twice onto the same chain. */
const assertNotAlreadySeeded = async (deployer) => {
  const normal = await deployer.launchpadCount(LAUNCHPAD_TYPE.NORMAL);
  const fair = await deployer.launchpadCount(LAUNCHPAD_TYPE.FAIR);
  if (normal.gt(0) || fair.gt(0)) {
    throw new Error(
      `Chain already has ${normal} normal and ${fair} fair launchpads. ` +
        `Reset it first:  docker compose down -v && docker compose up -d`
    );
  }
};

async function main() {
  const chainId = await chainTime.assertLocalChain();
  const deployment = loadDeployment();
  const accounts = await resolveAccounts();

  const apiBaseUrl = process.env.API_BASE_URL || "http://api:8888/api/v1";
  const metadata = new MetadataClient({ baseUrl: apiBaseUrl });

  log("Seeding DotLaunch demo environment");
  log(`  network    ${network.name} (chainId ${chainId})`);
  log(`  demo now   ${chainTime.iso(DEMO_NOW)}`);
  log(`  chain now  ${chainTime.iso(await chainTime.chainNow())}`);
  log(`  api        ${apiBaseUrl} ${(await metadata.probe()) ? "(reachable)" : "(unreachable — metadata will be placeholders)"}`);

  const deployer = await ethers.getContractAt(
    "LaunchpadDeployer",
    deployment.contracts.launchpadDeployer
  );
  const factory = await ethers.getContractAt(
    "ManageToken",
    deployment.contracts.manageToken
  );
  const locker = await ethers.getContractAt(
    "SenseiLock",
    deployment.contracts.tokenLock
  );

  await assertNotAlreadySeeded(deployer);

  // Rewind to the start of the demo history. The chain is started there by
  // compose, but this makes the script correct on a chain started elsewhere.
  await chainTime.travelTo(DEMO_NOW - HISTORY_DAYS * DAY);

  const context = { deployer, factory, locker, accounts, metadata, deployment };
  const tokenAddresses = {};
  // Which account holds each token's supply, so locks can be funded.
  const tokenMinters = {};

  step("Standalone tokens");
  for (const spec of STANDALONE_TOKENS) {
    tokenAddresses[spec.key] = await createToken(factory, accounts[spec.owner], spec);
    tokenMinters[spec.key] = spec.owner;
  }

  // Locks are created here, at the start of the demo history, rather than
  // after the presales. The lock contract refuses an unlock date in the past,
  // so the only honest way to end up with a matured, claimable lock is to
  // create it while its unlock date is still ahead and then let the clock
  // walk past it - which is exactly what seeding the presales does next.
  step("Token locks");
  await seedLocks({ ...context, locker }, tokenAddresses, tokenMinters);

  step("Presales");
  // Ordered by start time so the clock only ever moves forward.
  const ordered = [...PRESALES].sort((a, b) => a.startOffsetDays - b.startOffsetDays);
  const presales = [];
  for (const spec of ordered) {
    const result = await seedPresale(context, spec);
    tokenAddresses[result.key] = result.token;
    tokenMinters[result.key] = spec.owner;
    presales.push(result);
  }

  step("Finishing");
  // Park the clock exactly on the demo instant so the UI's frozen "now" and
  // the chain agree on which sales are live.
  await chainTime.travelTo(DEMO_NOW);

  const summary = {
    seededAt: new Date().toISOString(),
    demoNow: DEMO_NOW,
    chainNow: await chainTime.chainNow(),
    contracts: deployment.contracts,
    tokens: tokenAddresses,
    presales: presales.map((p) => ({ key: p.key, launchpad: p.launchpad, token: p.token })),
    accounts: {
      admin: accounts.admin.address,
      founder: accounts.founder.address,
      cofounder: accounts.cofounder.address,
      locker: accounts.locker.address,
      investors: accounts.investors.map((s) => s.address),
    },
  };

  const file = path.join(__dirname, "..", "deployments", `${network.name}.seed.json`);
  fs.writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`);

  log(`\nSeeded ${presales.length} presales, ${Object.keys(tokenAddresses).length} tokens.`);
  log(`Chain clock parked at ${chainTime.iso(summary.chainNow)}`);
  log(`Summary written to ${path.relative(process.cwd(), file)}`);
  log("\nOpen http://localhost:3000 — the app is populated and ready.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`\nSeeding failed: ${error.message}`);
    if (process.env.DEBUG) console.error(error);
    process.exit(1);
  });
