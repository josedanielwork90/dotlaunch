const { celebrate, Joi, Segments } = require("celebrate");
const router = require("express").Router();
const services = require("../services");
const jwt = require("../middlewares/jwt");

router.post(
  "/campaign/edit/:opcode",
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
    const { opcode } = req.params;
    const updateCampaignData = req.body;
    const CampaignService = new services.campaign();
    const isUpdatedCampaign = await CampaignService.editCampaign({
      opcode,
      campaignData: { ...updateCampaignData, owner: address },
    });
    if (!isUpdatedCampaign) {
      return next(new Error("Fail to update launchpad campaign"));
    }
    return res.status(200).end();
  }
);

router.get("/campaign/get/:opcode", async (req, res, next) => {
  const { opcode } = req.params;
  const CampaignService = new services.campaign();
  const campaignData = await CampaignService.getCampaign({ opcode });
  return res.status(200).json({ campaignData });
});

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

router.get(
  "/:launchpadAddress",
  celebrate({
    [Segments.PARAMS]: {
      launchpadAddress: Joi.string()
    }
  }),
  async (req, res, next) => {
    try {
      const { params: { launchpadAddress } } = req
      const LaunchpadService = new services.launchpad();
      const launchpad = await LaunchpadService.getLaunchpadDetail(launchpadAddress)
      return res.status(200).json({ launchpad })
    } catch (error) {
      return res.status(500).json({ message: "Cannot get. Please try again" })
    }
  }
)

router.post(
  "/list",
  celebrate({
    body: Joi.object({
      sort: Joi.object({}),
      filter: Joi.object({
        user: Joi.string(),
        launchPadType: Joi.number(),
        tokenSale: Joi.string(),
        status: Joi.string().valid("upcoming", "failed", "success", "active")
      }),
      size: Joi.number(),
      page: Joi.number(),
    }),
  }),
  async (req, res, next) => {
    try {
      const {
        filter,
        page,
        size,
        sort = { startTime: -1 },
      } = req.body;
      const LaunchpadService = new services.launchpad();
      if (filter && filter.user) {
        filter.user = new RegExp(["^", filter.user, "$"].join(""), "i")
      }
      if (filter && filter.tokenSale) {
        filter.tokenSale = new RegExp(["^", filter.tokenSale, "$"].join(""), "i")
      }
      if (filter && filter.status) {
        const { status } = filter
        delete filter.status
        const currentTime = Date.now()
        switch (status) {
          case "upcoming":
            filter.status = "0"
            filter.startTime = { $gt: currentTime }
            break
          case "failed":
            filter.$or = [
              { status: "2" },
              {
                status: "0",
                endTime: { $lt: currentTime },
                $or: [
                  {
                    launchPadType: 0,
                    $expr: { $gt: ["$softcap", "$totalRaised"] }
                  },
                  {
                    launchPadType: 1,
                    $expr: { $gt: ["$hardcap", "$totalRaised"] }
                  }
                ]
              }
            ]
            break
          case "success":
            filter.$or = [
              { status: "1" },
              {
                status: "0",
                endTime: { $lt: currentTime },
                $or: [
                  {
                    launchPadType: 0,
                    $expr: { $lte: ["$softcap", "$totalRaised"] }
                  },
                  {
                    launchPadType: 1,
                    $expr: { $lte: ["$hardcap", "$totalRaised"] }
                  }
                ]
              }
            ]
            break
          case "active":
            filter.status = "0"
            filter.startTime = { $lte: currentTime }
            filter.endTime = { $gte: currentTime }
            break
          default:
            break
        }
      }
      const { totalItems, launchpads, totalPages, currentPage } = await LaunchpadService.getLaunchpadsInfo({
        page,
        size,
        sort,
        filter,
      });
      return res.status(200).json({ totalItems, launchpads, totalPages, currentPage });
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: "Cannot get. Please try again" })
    }
  }
);

module.exports = router;
