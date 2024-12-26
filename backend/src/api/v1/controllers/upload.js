const { celebrate, Joi } = require("celebrate");
const router = require("express").Router();

const ipfs = require("../../../services/ipfs");
const jwt = require("../middlewares/jwt");

/**
 * Presale metadata upload.
 *
 * The browser posts the metadata document here rather than pinning it
 * itself, so the pinning credential never leaves the server.
 */

/**
 * POST /api/v1/upload/json
 * Pin a metadata document and return its gateway URL.
 */
router.post(
  "/json",
  jwt.isAuth,
  celebrate({
    body: Joi.object({
      name: Joi.string().max(200).optional(),
      content: Joi.object().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { name, content } = req.body;
      const { hash, url } = await ipfs.pinJSON(content, name);
      return res.status(201).json({ hash, url });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/v1/upload/json/:hash
 * Resolve a pinned document through the gateway.
 */
router.get(
  "/json/:hash",
  celebrate({
    params: Joi.object({
      hash: Joi.string().max(200).required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const document = await ipfs.fetchJSON(req.params.hash);
      if (document === null) {
        return res.status(404).json({ message: "Document not found" });
      }
      return res.json(document);
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/v1/upload/status
 * Whether pinning is configured and reachable.
 */
router.get("/status", async (req, res, next) => {
  try {
    return res.json(await ipfs.health());
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
