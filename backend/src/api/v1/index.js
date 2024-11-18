const authRouter = require("./controllers/auth");
const launchpadsRouter = require("./controllers/launchpads");
const storageRouter = require("./controllers/storage");
const healthRouter = require("./controllers/health");

const router = require("express").Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/launchpads", launchpadsRouter);
router.use("/storage", storageRouter);

module.exports = router;
