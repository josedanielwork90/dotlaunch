const { celebrate, Joi, Segments } = require("celebrate");
const router = require("express").Router();

const models = require("../../../models");
const jwt = require("../middlewares/jwt");
const { adminOnly } = require("../middlewares/adminOnly");
const { LAUNCHPAD_ONCHAIN_STATUS } = require("../../../helpers/constants");

/**
 * Administrative endpoints.
 *
 * KYC and audit badges are off-chain claims the platform makes about a
 * presale, so they are set here rather than by the indexer, which only ever
 * writes what the chain told it.
 */

router.use(jwt.isAuth, adminOnly);

/**
 * POST /api/v1/admin/launchpads/:address/badges
 * Set the KYC and audit badges on a presale.
 */
router.post(
  "/launchpads/:address/badges",
  celebrate({
    [Segments.PARAMS]: { address: Joi.string().required() },
    [Segments.BODY]: Joi.object({
      kyc: Joi.boolean(),
      audit: Joi.boolean(),
    }).min(1),
  }),
  async (req, res, next) => {
    try {
      const { address } = req.params;
      const update = {};
      if (req.body.kyc !== undefined) update.kyc = req.body.kyc;
      if (req.body.audit !== undefined) update.audit = req.body.audit;

      const result = await models.launchpadInfo.updateOne(
        { launchpad: new RegExp(`^${address}$`, "i") },
        { $set: update }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Unknown launchpad" });
      }
      return res.status(200).json({ launchpad: address, ...update });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/v1/admin/stats
 * Counts for the admin dashboard.
 */
router.get("/stats", async (req, res, next) => {
  try {
    const [total, opening, finished, cancelled, users] = await Promise.all([
      models.launchpadInfo.countDocuments({}),
      models.launchpadInfo.countDocuments({
        status: String(LAUNCHPAD_ONCHAIN_STATUS.OPENING),
      }),
      models.launchpadInfo.countDocuments({
        status: String(LAUNCHPAD_ONCHAIN_STATUS.FINISHED),
      }),
      models.launchpadInfo.countDocuments({
        status: String(LAUNCHPAD_ONCHAIN_STATUS.CANCELLED),
      }),
      models.userLogin.countDocuments({}),
    ]);

    return res.json({
      launchpads: { total, opening, finished, cancelled },
      users,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/admin/launchpads/pending
 * Presales with neither badge set, oldest first.
 */
router.get("/launchpads/pending", async (req, res, next) => {
  try {
    const pending = await models.launchpadInfo
      .find({ kyc: false, audit: false })
      .sort({ startTime: 1 })
      .limit(50);

    return res.json({ launchpads: pending });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
