/**
 * Domain constants and enumerations.
 *
 * Anything environment-specific (endpoints, secrets, contract addresses)
 * lives in `src/config` instead - this file must stay free of deployment
 * detail so it can be imported safely from tests.
 */

module.exports.USER_ROLE = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});

module.exports.BSC_EVENT_NAME = Object.freeze({
  LAUNCHPAD_CREATED: "launchpadDeployed",
  LAUNCHPAD_PARAMETER: "launchpadDeployedParameter",
  LAUNCHPAD_STATE_CHANGED: "launchpadStateChanged",
  LAUNCHPAD_RAISED_CHANGED: "launchpadRaisedChanged",
  LAUNCHPAD_ACTION_CHANGED: "launchpadActionChanged",
  LAUNCHPAD_WHITELIST_USERS_CHANGED: "launchpadWhitelistUsersChanged",
});

module.exports.LAUNCHPAD_ONCHAIN_STATUS = Object.freeze({
  OPENING: 0,
  FINISHED: 1,
  CANCELLED: 2,
});

module.exports.LAUNCHPAD_SALE_STATUS = Object.freeze({
  UPCOMMING: 0,
  LIVE: 1,
  ENDED: 2,
  CANCELLED: 3,
  FINISHED: 4,
});

module.exports.LAUNCH_PAD_TYPE = Object.freeze({
  NORMAL: 0,
  FAIR: 1,
});

module.exports.DEFAULT_PAGINATION_SETTING = Object.freeze({
  PAGE: 1,
  SIZE: 6,
});
