/**
 * The demo dataset.
 *
 * Declarative description of everything `seed-demo-data.js` puts on chain.
 * Keeping it separate from the seeding mechanics means the catalogue can be
 * read, reviewed and extended without touching transaction logic, and the
 * tests can assert against the same definitions the seeder uses.
 *
 * Times are expressed in days relative to the demo "now" (DEMO_NOW below).
 * A negative offset is in the past. The seeder walks the chain clock forward
 * through these windows so that every sale state a reviewer needs to see -
 * upcoming, live, ended, finalised, cancelled, failed - actually exists,
 * rather than being faked in the database.
 */

/** The instant the app treats as "now". Must match FIXED_NOW in .env.docker. */
const DEMO_NOW = 1749988800; // 2025-06-15T12:00:00Z

/** How far before DEMO_NOW the chain starts, so past sales have room to run. */
const HISTORY_DAYS = 45;

const DAY = 24 * 60 * 60;
const HOUR = 60 * 60;

/** Absolute unix time for an offset in days from the demo now. */
const at = (days) => Math.floor(DEMO_NOW + days * DAY);

/**
 * Demo accounts.
 *
 * Indices are into the standard 20-account HD wallet derived from the public
 * development mnemonic, so these are the same addresses on every machine.
 * The README publishes them as the "demo credentials" a reviewer logs in
 * with - in a wallet-based app the private key *is* the credential.
 */
const ACCOUNTS = Object.freeze({
  /** Platform admin: owns the deployer and the token factory. */
  admin: 0,
  /** Primary demo user. Created most of the presales below. */
  founder: 1,
  /** Second project owner, so "my launchpads" is not one account's view. */
  cofounder: 2,
  /** Investors used to fill sales to varied completion levels. */
  investors: [3, 4, 5, 6, 7, 8, 9, 10],
  /** Holds token and liquidity locks. */
  locker: 11,
});

/**
 * Presales.
 *
 * `state` drives what the seeder does after creation:
 *   upcoming  - created, sale window still in the future, no contributions
 *   live      - open now, partially filled
 *   whitelist - open now, whitelist enabled with a subset granted
 *   filled    - open now, at or near hardcap
 *   finalised - ran in the past, hit softcap, finished by the owner
 *   cancelled - ran in the past, cancelled by the owner
 *   failed    - ran in the past, closed below softcap
 */
const PRESALES = Object.freeze([
  {
    key: "nova",
    name: "Nova Protocol",
    symbol: "NOVA",
    decimals: 18,
    supply: "500000000",
    owner: "founder",
    state: "live",
    type: "NORMAL",
    payment: "native",
    softCap: "40",
    hardCap: "120",
    presaleRate: 2500,
    listingRate: 2000,
    minBuy: "0.1",
    maxBuy: "8",
    startOffsetDays: -3,
    endOffsetDays: 6,
    saleEndOffsetDays: 8,
    contributions: ["6.5", "8", "4.2", "2", "7.5", "1.25"],
    metadata: {
      description:
        "Nova Protocol is a modular liquidity layer that lets any application " +
        "route orders across chains without holding inventory. The presale " +
        "funds the first two production integrations and a third-party audit.",
      website: "https://nova.example",
      whitepaper: "https://nova.example/whitepaper.pdf",
      tags: ["DeFi", "Infrastructure", "Audited"],
      socials: {
        twitter: "https://twitter.com/example_nova",
        telegram: "https://t.me/example_nova",
        github: "https://github.com/example/nova",
      },
    },
  },
  {
    key: "aurora",
    name: "Aurora Finance",
    symbol: "AURA",
    decimals: 18,
    supply: "250000000",
    owner: "founder",
    state: "filled",
    type: "NORMAL",
    payment: "native",
    softCap: "30",
    hardCap: "60",
    presaleRate: 1800,
    listingRate: 1500,
    minBuy: "0.25",
    maxBuy: "10",
    startOffsetDays: -5,
    endOffsetDays: 0.25,
    saleEndOffsetDays: 3,
    contributions: ["10", "10", "9.5", "8", "10", "7", "5.5"],
    metadata: {
      description:
        "Aurora Finance is a fixed-rate lending market. Rates are set by " +
        "auction at the start of each term, so borrowers know their cost for " +
        "the whole period rather than tracking a floating curve.",
      website: "https://aurora.example",
      tags: ["DeFi", "Lending"],
      socials: {
        twitter: "https://twitter.com/example_aurora",
        telegram: "https://t.me/example_aurora",
      },
    },
  },
  {
    key: "helix",
    name: "Helix Chain",
    symbol: "HLX",
    decimals: 18,
    supply: "1000000000",
    owner: "cofounder",
    state: "upcoming",
    type: "NORMAL",
    payment: "native",
    softCap: "80",
    hardCap: "200",
    presaleRate: 4000,
    listingRate: 3200,
    minBuy: "0.5",
    maxBuy: "15",
    startOffsetDays: 2,
    endOffsetDays: 12,
    saleEndOffsetDays: 14,
    contributions: [],
    metadata: {
      description:
        "Helix Chain is a data-availability network for rollups, priced per " +
        "byte-hour rather than per blob. The presale funds validator " +
        "incentives for the first year of mainnet.",
      website: "https://helix.example",
      whitepaper: "https://helix.example/paper.pdf",
      tags: ["Infrastructure", "L2"],
      socials: {
        twitter: "https://twitter.com/example_helix",
        discord: "https://discord.gg/example",
      },
    },
  },
  {
    key: "quantum",
    name: "Quantum Vault",
    symbol: "QVT",
    decimals: 18,
    supply: "80000000",
    owner: "cofounder",
    state: "whitelist",
    type: "NORMAL",
    payment: "native",
    softCap: "25",
    hardCap: "75",
    presaleRate: 900,
    listingRate: 750,
    minBuy: "0.5",
    maxBuy: "12",
    startOffsetDays: -1,
    endOffsetDays: 9,
    saleEndOffsetDays: 11,
    // Only whitelisted investors contribute while the gate is up.
    contributions: ["9", "6.5", "11"],
    whitelistCount: 4,
    metadata: {
      description:
        "Quantum Vault runs delta-neutral strategies with on-chain proof of " +
        "reserves. Access to the presale is whitelisted for addresses that " +
        "completed the community round.",
      website: "https://quantum.example",
      tags: ["DeFi", "Yield", "Whitelist"],
      socials: { twitter: "https://twitter.com/example_qvt" },
    },
  },
  {
    key: "zenith",
    name: "Zenith Labs",
    symbol: "ZNTH",
    decimals: 18,
    supply: "120000000",
    owner: "founder",
    state: "live",
    type: "FAIR",
    payment: "native",
    // Fair launches carry no softcap and no per-wallet limits; the deployer
    // rejects the sale outright if any of those are set.
    softCap: "0",
    hardCap: "50",
    presaleRate: 1200,
    listingRate: 1000,
    minBuy: "0",
    maxBuy: "0",
    startOffsetDays: -2,
    endOffsetDays: 7,
    saleEndOffsetDays: 9,
    contributions: ["3.5", "12", "6", "2.25"],
    metadata: {
      description:
        "Zenith Labs builds verifiable off-chain compute. This is a fair " +
        "launch: every contributor receives a share of the pool proportional " +
        "to their contribution, with no allocation caps.",
      website: "https://zenith.example",
      tags: ["Fair Launch", "Compute"],
      socials: { twitter: "https://twitter.com/example_zenith" },
    },
  },
  {
    key: "solaris",
    name: "Solaris DAO",
    symbol: "SOL8",
    decimals: 18,
    supply: "300000000",
    owner: "founder",
    state: "finalised",
    type: "NORMAL",
    payment: "native",
    softCap: "20",
    hardCap: "40",
    presaleRate: 1500,
    listingRate: 1200,
    minBuy: "0.2",
    maxBuy: "8",
    startOffsetDays: -32,
    endOffsetDays: -24,
    saleEndOffsetDays: -22,
    contributions: ["8", "8", "7.5", "6", "5.5", "5"],
    metadata: {
      description:
        "Solaris DAO funds open-source public goods through quadratic " +
        "matching. The presale closed above its softcap and liquidity has " +
        "been locked for twelve months.",
      website: "https://solaris.example",
      tags: ["DAO", "Public Goods", "Completed"],
      socials: { twitter: "https://twitter.com/example_solaris" },
    },
  },
  {
    key: "meridian",
    name: "Meridian",
    symbol: "MRDN",
    decimals: 18,
    supply: "150000000",
    owner: "cofounder",
    state: "cancelled",
    type: "NORMAL",
    payment: "native",
    softCap: "50",
    hardCap: "100",
    presaleRate: 2200,
    listingRate: 1800,
    minBuy: "0.5",
    maxBuy: "10",
    startOffsetDays: -28,
    endOffsetDays: -18,
    saleEndOffsetDays: -16,
    contributions: ["4", "3.5", "2"],
    metadata: {
      description:
        "Meridian was a cross-margin perpetuals venue. The team cancelled " +
        "the raise before close and all contributions became refundable.",
      website: "https://meridian.example",
      tags: ["Cancelled"],
      socials: { twitter: "https://twitter.com/example_meridian" },
    },
  },
  {
    key: "cobalt",
    name: "Cobalt Network",
    symbol: "CBLT",
    decimals: 18,
    supply: "60000000",
    owner: "cofounder",
    state: "failed",
    type: "NORMAL",
    payment: "native",
    softCap: "60",
    hardCap: "120",
    presaleRate: 800,
    listingRate: 650,
    minBuy: "0.5",
    maxBuy: "12",
    startOffsetDays: -20,
    endOffsetDays: -8,
    saleEndOffsetDays: -6,
    // Deliberately well under the 60 softcap so the UI shows a failed raise.
    contributions: ["6", "4.5", "3"],
    metadata: {
      description:
        "Cobalt Network aimed to build a decentralised CDN. The raise closed " +
        "below its softcap, so contributors can reclaim their funds in full.",
      website: "https://cobalt.example",
      tags: ["Failed", "Refundable"],
      socials: { twitter: "https://twitter.com/example_cobalt" },
    },
  },
]);

module.exports = { DEMO_NOW, HISTORY_DAYS, DAY, HOUR, at, ACCOUNTS, PRESALES };
