const { expressjwt } = require("express-jwt");
const jwtGeneration = require("jsonwebtoken");
const config = require("../../../config");

const getTokenFromHeader = (req) => {
  if (
    (req.headers.authorization &&
      req.headers.authorization.split(" ")[0] === "Token") ||
    (req.headers.authorization &&
      req.headers.authorization.split(" ")[0] === "Bearer")
  ) {
    return req.headers.authorization.split(" ")[1];
  }
  return null;
};

const createToken = ({ address, role }) => {
  return jwtGeneration.sign({ address, role }, config.jwt.secret, {
    expiresIn: config.jwt.ttl,
  });
};

const isAuth = expressjwt({
  secret: config.jwt.secret,
  algorithms: config.jwt.algorithms,
  getToken: getTokenFromHeader,
});

module.exports = { isAuth, createToken };
