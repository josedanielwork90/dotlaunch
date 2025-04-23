/**
 * Jest setup, applied to every suite.
 *
 * Pins the environment so tests never depend on a developer's local
 * configuration, and never reach a real network or a real database by
 * accident. Anything a suite needs beyond this it sets up itself.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-signing-secret";
process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER || "local";
process.env.EVENT_LISTENER_ENABLED = "false";

// Chain calls in unit tests point at a port nothing listens on, so a test
// that accidentally makes a live request fails fast rather than hanging.
process.env.CHAIN_RPC_URL = process.env.CHAIN_RPC_URL || "http://127.0.0.1:1";

/**
 * Pin the application clock, matching the seeded demo environment.
 *
 * Time-derived behaviour (which presales count as upcoming, active, or
 * closed) is only testable against a known instant. Fixing it here also
 * means a suite that positions fixtures around this instant will fail if
 * production code goes back to reading the system clock, rather than the
 * fixtures silently drifting along with it.
 */
process.env.FIXED_NOW = process.env.FIXED_NOW || "2025-06-15T12:00:00Z";

jest.setTimeout(30000);
