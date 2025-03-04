/**
 * Turning thrown values into something a user can read.
 *
 * Errors arriving here come from three very different places and none of
 * them are plain `Error` objects:
 *
 *   - wallet providers throw EIP-1193 objects with a numeric `code` and,
 *     often, a nested `data.message` holding the real reason
 *   - ethers wraps contract reverts several layers deep, with the useful
 *     text in `error.error.message` or `error.reason`
 *   - axios rejects with a response body rather than a message
 *
 * A `catch` binding is typed `unknown`, and this project's Babel toolchain
 * does not accept a type assertion to narrow it (see utils/runtimeConfig),
 * so these helpers take `any` and do the narrowing behind a typed return.
 * That keeps the untyped access in one reviewed place instead of spread
 * across every call site.
 */

/** EIP-1193: the user rejected the request in their wallet. */
export const USER_REJECTED_CODE = 4001;

/** EIP-1193: the wallet does not know the requested chain. */
export const UNRECOGNISED_CHAIN_CODE = 4902;

/**
 * Solidity revert strings are prefixed by the node before they reach us.
 * Stripping the prefixes turns
 * "execution reverted: revert: Launchpad: Sale is not open"
 * into "Launchpad: Sale is not open".
 */
const REVERT_PREFIXES = [
  /^execution reverted:?\s*/i,
  // Note the optional colon: nodes emit "revert: reason" as well as
  // "revert reason", and matching only the latter left the word "revert:"
  // stuck on the front of every message shown to a user.
  /^revert:?\s*/i,
  /^Error:\s*/i,
];

const stripRevertPrefix = (message: string): string => {
  let result = message.trim();
  let changed = true;

  // Applied repeatedly because the prefixes stack.
  while (changed) {
    changed = false;
    REVERT_PREFIXES.forEach((pattern) => {
      const next = result.replace(pattern, "");
      if (next !== result) {
        result = next.trim();
        changed = true;
      }
    });
  }

  return result;
};

/**
 * The most specific message available on a thrown value.
 *
 * @param error Anything caught.
 * @param fallback Returned when nothing usable can be found.
 */
export const errorMessage = (error: any, fallback = "Something went wrong."): string => {
  if (!error) return fallback;

  if (typeof error === "string") return stripRevertPrefix(error) || fallback;

  // ethers nests the node's response; it carries the actual revert reason.
  const candidates = [
    error.error && error.error.message,
    error.data && error.data.message,
    error.reason,
    error.response && error.response.data && error.response.data.message,
    error.message,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return stripRevertPrefix(candidate) || fallback;
    }
  }

  return fallback;
};

/** True when the user dismissed a wallet prompt rather than hitting a failure. */
export const isUserRejection = (error: any): boolean => {
  if (!error) return false;
  if (error.code === USER_REJECTED_CODE) return true;
  if (error.error && error.error.code === USER_REJECTED_CODE) return true;

  const message = errorMessage(error, "").toLowerCase();
  return message.indexOf("user rejected") !== -1 || message.indexOf("user denied") !== -1;
};

/** True when the wallet does not yet know the chain we asked it to use. */
export const isUnrecognisedChain = (error: any): boolean => {
  if (!error) return false;
  if (error.code === UNRECOGNISED_CHAIN_CODE) return true;
  return Boolean(error.error && error.error.code === UNRECOGNISED_CHAIN_CODE);
};

/**
 * A message suitable for a toast.
 *
 * User rejections are not failures and should not be reported as errors, so
 * this returns an empty string for them and the caller stays silent.
 */
export const toastableError = (error: any, fallback?: string): string => {
  if (isUserRejection(error)) return "";
  return errorMessage(error, fallback);
};

export default errorMessage;
