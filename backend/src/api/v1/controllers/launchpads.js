const { celebrate, Joi, Segments } = require("celebrate");
const router = require("express").Router();
const services = require("../services");
const jwt = require("../middlewares/jwt");

router.post(
  "/campaign/create",
  jwt.isAuth,
  celebrate({
    body: Joi.object({
      description: Joi.string(),
      discord: Joi.string(),
      facebook: Joi.string(),
      github: Joi.string(),
      logo: Joi.string(),
      reddit: Joi.string(),
      telegram: Joi.string(),
      twitter: Joi.string(),
      youtube: Joi.string(),
      updates: Joi.string(),
      website: Joi.string(),
    }),
  }),
  async (req, res, next) => {
    const { address } = req.auth;
    const campaignData = req.body;
    const CampaignService = new services.campaign();
    const [isCreatedNewCampaignOk, opcode] =
      await CampaignService.createNewCampaign({
        campaignData: { ...campaignData, owner: address },
      });
    if (!isCreatedNewCampaignOk) {
      return next(new Error("Fail to create launchpad campaign"));
    }
    return res.status(200).json({ opcode });
  }
);

router.get("/campaign/get/:opcode", async (req, res, next) => {
  const { opcode } = req.params;
  const CampaignService = new services.campaign();
  const campaignData = await CampaignService.getCampaign({ opcode });
  return res.status(200).json({ campaignData });
});

router.get(
  "/:launchpadAddress",
  celebrate({
    [Segments.PARAMS]: {
      launchpadAddress: Joi.string(),
    },
  }),
  async (req, res, next) => {
    try {
      const {
        params: { launchpadAddress },
      } = req;
      const LaunchpadService = new services.launchpad();
      const launchpad = await LaunchpadService.getLaunchpadDetail(
        launchpadAddress
      );
      return res.status(200).json({ launchpad });
    } catch (error) {
      return res.status(500).json({ message: "Cannot get. Please try again" });
    }
  }
);

router.post(
  "/list",
  celebrate({
    body: Joi.object({
      sort: Joi.object({}),
      filter: Joi.object({
        user: Joi.string(),
        launchPadType: Joi.number(),
        tokenSale: Joi.string(),
      }),
      size: Joi.number(),
      page: Joi.number(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { filter, page, size, sort = { startTime: -1 } } = req.body;
      const LaunchpadService = new services.launchpad();
      const { totalItems, launchpads, totalPages, currentPage } =
        await LaunchpadService.getLaunchpadsInfo({
          page,
          size,
          sort,
          filter,
        });
      return res
        .status(200)
        .json({ totalItems, launchpads, totalPages, currentPage });
    } catch (error) {
      return res.status(500).json({ message: "Cannot get. Please try again" });
    }
  }
);

module.exports = router;
