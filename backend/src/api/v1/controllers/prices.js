const router = require("express").Router();

const priceFeed = require("../../../services/priceFeed");

/**
 * Cached native-coin prices.
 *
 * One upstream poll serves every visitor, so the public price API sees a
 * request a minute rather than one per rendered card.
 */

/**
 * GET /api/v1/prices
 * Latest quotes, with the age of the snapshot.
 */
router.get("/", async (req, res, next) => {
  try {
    const { prices, updatedAt, stale } = priceFeed.snapshot();

    if (stale) {
      // Serve the last known values, but say so, so the client can decide
      // whether to show a dollar figure at all.
      res.set("Cache-Control", "no-store");
    } else {
      res.set("Cache-Control", "public, max-age=30");
    }

    return res.json({ prices, updatedAt, stale });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/prices/:symbol
 * One quote, or 404 when the symbol is not tracked.
 */
router.get("/:symbol", async (req, res, next) => {
  try {
    const symbol = String(req.params.symbol).toLowerCase();
    const { prices, updatedAt, stale } = priceFeed.snapshot();

    if (prices[symbol] === undefined) {
      return res.status(404).json({ message: `No quote for "${symbol}"` });
    }

    return res.json({ symbol, usd: prices[symbol], updatedAt, stale });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
