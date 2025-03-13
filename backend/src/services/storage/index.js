const config = require("../../config");
const StorageProvider = require("./StorageProvider");
const LocalStorageProvider = require("./LocalStorageProvider");
const PinataStorageProvider = require("./PinataStorageProvider");

/**
 * Builds the storage provider named by STORAGE_DRIVER.
 *
 * @param {object} [overrides] Test seam: bypasses the ambient config.
 * @returns {StorageProvider}
 */
const createStorageProvider = (overrides = {}) => {
  const settings = { ...config.storage, ...overrides };

  switch (settings.driver) {
    case "local":
      return new LocalStorageProvider({
        directory: settings.localDir,
        publicBaseUrl: settings.publicBaseUrl,
      });

    case "pinata":
      return new PinataStorageProvider({
        jwt: settings.pinataJwt,
        gatewayUrl: settings.pinataGateway,
      });

    default:
      throw new Error(
        `Unknown STORAGE_DRIVER "${settings.driver}". Expected "local" or "pinata".`
      );
  }
};

/**
 * The process-wide provider.
 *
 * Constructed on first access rather than at import time, so requiring this
 * module in a test does not create directories or validate credentials until
 * something actually stores a document.
 */
let instance = null;
const getStorageProvider = () => {
  if (instance === null) {
    instance = createStorageProvider();
  }
  return instance;
};

/** Drop the memoised provider. Used by tests that switch drivers. */
const resetStorageProvider = () => {
  instance = null;
};

module.exports = {
  StorageProvider,
  LocalStorageProvider,
  PinataStorageProvider,
  createStorageProvider,
  getStorageProvider,
  resetStorageProvider,
};
