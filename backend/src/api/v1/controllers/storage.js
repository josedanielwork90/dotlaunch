const { celebrate, Joi } = require("celebrate");
const router = require("express").Router();

const { getStorageProvider } = require("../../../services/storage");

/**
 * Off-chain metadata storage.
 *
 * Presale and token metadata is written here and referenced on-chain by URI.
 * Routing it through the API rather than letting the browser talk to a
 * pinning service directly means no storage credential ever reaches the
 * client, and the local driver can stand in for IPFS with no code change.
 */

/**
 * POST /api/v1/storage
 * Store a JSON document; returns its content id and public URL.
 */
router.post(
  "/",
  celebrate({
    body: Joi.object({
      name: Joi.string().max(200).optional(),
      content: Joi.object().required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { name, content } = req.body;
      const { cid, url } = await getStorageProvider().putJSON(content, { name });
      return res.status(201).json({ cid, url });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/v1/storage/:cid
 * Serve a stored document back.
 */
router.get(
  "/:cid",
  celebrate({
    params: Joi.object({
      cid: Joi.string().max(200).required(),
    }),
  }),
  async (req, res, next) => {
    try {
      const document = await getStorageProvider().getJSON(req.params.cid);
      if (document === null) {
        return res.status(404).json({ message: "Document not found" });
      }
      // Content-addressed, so the body for a given id can never change.
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      return res.json(document);
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
