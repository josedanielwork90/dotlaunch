const { celebrate, Joi, Segments } = require("celebrate");
const router = require("express").Router();

const models = require("../../../models");

/**
 * Presale search.
 *
 * The list endpoint filters on exact fields; this answers the "I know part of
 * the name" case that the header search box needs. Matching is done in Mongo
 * with a case-insensitive prefix regex rather than a text index, because the
 * corpus is small and a text index would need re-tuning every time a field is
 * added.
 */

const MAX_RESULTS = 20;

/** Escape a user string so it cannot smuggle regex syntax into the query. */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/v1/search?q=nova
 * Presales whose name, symbol or address starts with `q`.
 */
router.get(
  "/",
  celebrate({
    [Segments.QUERY]: Joi.object({
      q: Joi.string().min(2).max(64).required(),
      limit: Joi.number().min(1).max(MAX_RESULTS),
    }),
  }),
  async (req, res, next) => {
    try {
      const { q, limit = 10 } = req.query;
      const prefix = new RegExp(`^${escapeRegex(q)}`, "i");
      const anywhere = new RegExp(escapeRegex(q), "i");

      const results = await models.launchpadInfo
        .find({
          $or: [
            { name: anywhere },
            { symbol: prefix },
            { launchpad: prefix },
            { tokenSale: prefix },
          ],
        })
        .select("launchpad tokenSale name symbol status startTime endTime")
        .sort({ startTime: -1 })
        .limit(Math.min(Number(limit), MAX_RESULTS));

      return res.json({ query: q, results });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/v1/search/suggest?q=no
 * Just enough to render the type-ahead dropdown.
 */
router.get(
  "/suggest",
  celebrate({
    [Segments.QUERY]: Joi.object({
      q: Joi.string().min(1).max(64).required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const prefix = new RegExp(`^${escapeRegex(req.query.q)}`, "i");

      const suggestions = await models.launchpadInfo
        .find({ $or: [{ name: prefix }, { symbol: prefix }] })
        .select("launchpad name symbol")
        .limit(8);

      return res.json({ suggestions });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
module.exports.escapeRegex = escapeRegex;
