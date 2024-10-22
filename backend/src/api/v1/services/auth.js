const models = require("../../../models");

class AuthService {
  signIn = async ({ address, network, role }) => {
    try {
      const user = await models.userLogin.findOne({ address });
      if (user === null) {
        await models.userLogin.create({ address, network, role });
      }
      return [true, null];
    } catch (err) {
      return [false, err];
    }
  };
}

module.exports = AuthService;
