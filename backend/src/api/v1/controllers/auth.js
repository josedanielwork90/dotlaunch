const { celebrate, Joi } = require("celebrate");
const router = require("express").Router();
const services = require("../services");
const { USER_ROLE } = require("../../../helpers/constants");
const jwt = require("../middlewares/jwt");

router.post(
  "/sign-in",
  celebrate({
    body: Joi.object({
      address: Joi.string().required(),
      nonce: Joi.string().required(),
      signature: Joi.string().required(),
      network: Joi.string().required(),
    }),
  }),
  async (req, res, next) => {
    const { address, network, nonce, signature } = req.body;
    const role = USER_ROLE.USER;
    const authService = new services.auth();
    const walletService = new services.wallet({
      publicKey: address,
    });

    // `await` is essential here: isSignerOfMessage is async, so without it
    // this holds a Promise - which is always truthy - and the guard below
    // never fires. That made the signature check a no-op and let anyone
    // obtain a token for any address.
    const isSignerOfMessage = await walletService.isSignerOfMessage({
      message: nonce,
      signature,
    });
    if (!isSignerOfMessage) {
      const error = new Error("Signature does not match the supplied address");
      error.status = 401;
      return next(error);
    }
    const [signInOk, signInErr] = await authService.signIn({
      address,
      network,
      role,
    });
    if (!signInOk) {
      return next(signInErr);
    }
    return res.status(200).json({ token: jwt.createToken({ address, role }) });
  }
);

module.exports = router;
