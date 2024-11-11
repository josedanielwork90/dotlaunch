const { DEFAULT_PAGINATION_SETTING } = require("../../../helpers/constants")
const models = require("../../../models");

class LaunchpadService {
  getLaunchpadsInfo = async ({ page, size, sort, filter }) => {
    try {
      const { limit, offset } = this.getPagination(page, size);
      const data = await models.launchpadInfo.paginate(filter, { offset, limit, sort })
      return {
        totalItems: data.totalDocs,
        launchpads: data.docs,
        totalPages: data.totalPages,
        currentPage: data.page - 1
      }
    } catch (err) {
      return {};
    }
  };

  getLaunchpadDetail = async (launchpadAddress) => {
    try {
      const launchpad = await models.launchpadInfo.findOne({ launchpad: launchpadAddress })
      return launchpad
    } catch (error) {
      return {}
    }
  }

  formatLaunchpadsInfo = ({ launchpadsInfo }) => {
    return launchpadsInfo.map((launchpadInfo) => ({
      ...launchpadInfo,
      status: this.getCurrentLaunchpadStatus(launchpadInfo),
    }));
  };

  getPagination = (page, size) => {
    const limit = size ? +size : DEFAULT_PAGINATION_SETTING.SIZE;
    const offset = page ? page * limit : 0;
    
    return { limit, offset };
  };

  getCurrentLaunchpadStatus = {};
}

module.exports = LaunchpadService;
