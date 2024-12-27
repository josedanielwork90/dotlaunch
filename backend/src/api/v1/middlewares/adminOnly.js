const { USER_ROLE } = require("../../../helpers/constants");

/**
 * Restrict a route to administrators.
 *
 * Runs after `jwt.isAuth`, so a token has already been verified and its
 * claims are on `req.auth`. Reading the role from the token rather than from
 * the database is deliberate: the role is signed, and a database lookup on
 * every admin request buys nothing until roles can change mid-session.
 */
const adminOnly = (req, res, next) => {
  if (!req.auth) {
    const error = new Error("Authentication required");
    error.status = 401;
    return next(error);
  }

  if (req.auth.role !== USER_ROLE.ADMIN) {
    const error = new Error("Administrator access required");
    error.status = 403;
    return next(error);
  }

  return next();
};

/** Addresses allowed to hold the admin role, from the environment. */
const adminAddresses = () =>
  (process.env.ADMIN_ADDRESSES || "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);

/** Whether `address` is configured as an administrator. */
const isAdminAddress = (address) =>
  typeof address === "string" &&
  adminAddresses().includes(address.toLowerCase());

module.exports = { adminOnly, adminAddresses, isAdminAddress };
