const ListenerState = require("../../../models/ListenerState");

const updateListenerState = (job, lastListenedBlock, isForce) =>
  ListenerState.updateOne(
    { jobName: job },
    isForce ? { lastListenedBlock } : { $max: { lastListenedBlock } },
    { upsert: true }
  );

module.exports.updateListenerState = updateListenerState;

/**
 * Reset a job's cursor so the next tick rescans from the start.
 *
 * This called a bare `updateListenerState`, which was only ever attached to
 * `module.exports` and never declared as a binding - so the function threw a
 * ReferenceError instead of clearing anything.
 */
module.exports.clearListenerState = (job) =>
  updateListenerState(job, null, true);

module.exports.getListenerState = async (job) => {
  const res = await ListenerState.findOne({ jobName: job }).exec();
  return res ? res.lastListenedBlock : null;
};

module.exports.getCronState = async (job) => {
  const res = await ListenerState.findOne({ jobName: job }).exec();
  return res
    ? { lastCronBlock: res.lastCronBlock, isForcedCron: res.isForcedCron }
    : {};
};

module.exports.updateCronState = (job, lastCronBlock) =>
  ListenerState.updateOne(
    { jobName: job },
    { lastCronBlock },
    { upsert: true }
  );

module.exports.getListenerTimestamp = async (job) => {
  const res = await ListenerState.findOne({ jobName: job }, "updatedAt").exec();
  return res ? res.updatedAt : null;
};

module.exports.setForceCron = (job, lastCronBlock) =>
  ListenerState.updateOne(
    { jobName: job },
    { lastCronBlock: lastCronBlock || null, isForcedCron: true },
    { upsert: true }
  );

module.exports.clearForceCron = (job) =>
  ListenerState.updateOne(
    { jobName: job },
    { isForcedCron: false },
    { upsert: true }
  );
