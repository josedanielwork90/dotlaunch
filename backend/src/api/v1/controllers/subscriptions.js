const { celebrate, Joi, Segments } = require("celebrate");
const router = require("express").Router();

const Subscription = require("../../../models/subscription");
const jwt = require("../middlewares/jwt");

/**
 * Presale watch list.
 *
 * A subscription belongs to the wallet that created it, taken from the token
 * rather than the body - otherwise anyone could sign someone else's address
 * up for notifications, or unsubscribe them.
 */

const EVENTS = ["opening", "closing", "finished", "cancelled"];

/**
 * POST /api/v1/subscriptions
 * Watch a presale.
 */
router.post(
  "/",
  jwt.isAuth,
  celebrate({
    [Segments.BODY]: Joi.object({
      launchpad: Joi.string().required(),
      channel: Joi.string().valid("email", "telegram", "webhook").default("email"),
      destination: Joi.string().max(300).required(),
      events: Joi.array().items(Joi.string().valid(...EVENTS)).min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const { address } = req.auth;
      const { launchpad, channel, destination, events } = req.body;

      const subscription = await Subscription.findOneAndUpdate(
        { address: address.toLowerCase(), launchpad: launchpad.toLowerCase(), channel },
        { destination, events: events || undefined },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return res.status(201).json({ subscription });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/v1/subscriptions
 * Everything the caller is watching.
 */
router.get("/", jwt.isAuth, async (req, res, next) => {
  try {
    const subscriptions = await Subscription
      .find({ address: req.auth.address.toLowerCase() })
      .sort({ createdAt: -1 });

    return res.json({ subscriptions });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/v1/subscriptions/:launchpad
 * Stop watching a presale on every channel.
 */
router.delete(
  "/:launchpad",
  jwt.isAuth,
  celebrate({
    [Segments.PARAMS]: Joi.object({ launchpad: Joi.string().required() }),
  }),
  async (req, res, next) => {
    try {
      const result = await Subscription.deleteMany({
        address: req.auth.address.toLowerCase(),
        launchpad: req.params.launchpad.toLowerCase(),
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Not subscribed" });
      }
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
