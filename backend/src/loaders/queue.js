const Bull = require("bull");
const config = require("../config");
const loggerContainer = require("./loggerContainer");
const logger = loggerContainer.get("EVENT_LISTENER_WORKER");
const eventHandle = require("../events");
const jobOptions = {
  removeOnComplete: true,
  removeOnFail: true,
  delay: 2000,
  attempts: 3,
  max: 500,
  duration: 5000,
};

const handlerCompleted = (job) => {
  logger.info(
    `Job in ${job.queue.name} completed for: ${JSON.stringify(job.data)}`
  );
  job.remove();
};

const handlerFailure = (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    logger.info(
      `Job failures above threshold in ${job.queue.name} for: ${job.id}`,
      err
    );
    return null;
  }
  logger.info(
    `Job in ${job.queue.name} failed for: ${job.id} with ${err.message}. ${
      job.opts.attempts - job.attemptsMade
    } attempts left`
  );
};

const handlerStalled = (job) => {
  logger.info(`Job in ${job.queue.name} stalled for: ${job.id}`);
};

class Queue {
  #name;
  #url;
  #context;
  #processFunc;
  constructor({ queueName, queueUrl, processFunc }) {
    this.#name = queueName;
    this.#url = queueUrl;
    this.#context = new Bull(queueName, queueUrl);
    this.#processFunc = processFunc;
  }

  listen = () => {
    this.#context.process(this.#processFunc);
    this.#context.on("failed", handlerFailure);
    this.#context.on("completed", handlerCompleted);
    this.#context.on("stalled", handlerStalled);
  };
  send = async ({ data, option = jobOptions }) => {
    await this.#context.add(data, option);
  };
}

const queueList = Object.freeze({
  bscContractEvent: new Queue({
    queueName: "bscContractEvent",
    queueUrl: config.redis.url,
    processFunc: eventHandle.bsc,
  }),
});

const loader = () => {
  Object.values(queueList).forEach((queue) => queue.listen());
};

module.exports = { queueList, loader };
