const models = require("../../../models");
const { ulid } = require("ulid");
class CampaignService {
  createNewCampaign = async ({ campaignData }) => {
    try {
      const newOpcode = ulid();
      await models.launchpadCampaign.create({
        ...campaignData,
        opcode: newOpcode,
      });
      return [true, newOpcode];
    } catch (err) {
      return [false, null];
    }
  };

  getCampaign = async ({ opcode }) => {
    try {
      const campaignData = await models.launchpadCampaign.findOne({
        opcode,
      });
      return campaignData === null ? {} : campaignData;
    } catch (err) {
      return {};
    }
  };

  editCampaign = async ({ opcode, campaignData }) => {
    try {
      const oldCampaignData = await models.launchpadCampaign.findOne({
        opcode,
      });
      if (
        oldCampaignData === null ||
        oldCampaignData.owner.toLowerCase() !== campaignData.owner.toLowerCase()
      ) {
        return false;
      }
      await models.launchpadCampaign.updateOne(
        {
          opcode,
        },
        { ...campaignData }
      );
      return true;
    } catch (err) {
      return false;
    }
  };
}

module.exports = CampaignService;
