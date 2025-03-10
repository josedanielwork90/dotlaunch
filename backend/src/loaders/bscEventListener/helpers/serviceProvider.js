const ethers = require("ethers");
const config = require("../../../config");
const RPC_ENDPOINT = config.chain.rpcUrl;

const getProviderByUrl = (url) => {
  switch (true) {
    case url.indexOf("ws") === 0:
      return "WebSocketProvider";
    case url.indexOf("http") === 0:
      return "JsonRpcProvider";
    default:
      return "IpcProvider";
  }
};

const provider = new ethers.providers[getProviderByUrl(RPC_ENDPOINT)](
  RPC_ENDPOINT
);

module.exports = provider;
