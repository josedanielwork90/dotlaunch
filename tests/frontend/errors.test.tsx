import {
  errorMessage,
  isUserRejection,
  isUnrecognisedChain,
  toastableError,
  USER_REJECTED_CODE,
  UNRECOGNISED_CHAIN_CODE,
} from "../../frontend/src/utils/errors";

/**
 * Turning thrown values into readable messages.
 *
 * The inputs here are real shapes: ethers nests a node's revert reason
 * several layers down, wallet providers throw EIP-1193 objects, and axios
 * rejects with a response body. Getting this wrong shows the user
 * "[object Object]" or a stack trace.
 */
describe("errorMessage", () => {
  it("reads a plain Error", () => {
    expect(errorMessage(new Error("Something specific"))).toBe(
      "Something specific"
    );
  });

  it("reads a bare string", () => {
    expect(errorMessage("Just a string")).toBe("Just a string");
  });

  it("falls back for null, undefined and empty values", () => {
    expect(errorMessage(null, "fallback")).toBe("fallback");
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
    expect(errorMessage({}, "fallback")).toBe("fallback");
  });

  describe("revert reasons", () => {
    it("strips the node's execution-reverted prefixes", () => {
      expect(
        errorMessage(
          new Error("execution reverted: revert: Launchpad: Sale is not open")
        )
      ).toBe("Launchpad: Sale is not open");
    });

    it("strips a single prefix", () => {
      expect(errorMessage(new Error("execution reverted: Hardcap reached"))).toBe(
        "Hardcap reached"
      );
    });

    /** ethers puts the useful text on a nested `error` object. */
    it("prefers the nested node message over the wrapper", () => {
      const thrown = {
        message: "cannot estimate gas; transaction may fail",
        error: { message: "execution reverted: revert: Soft cap not reached" },
      };

      expect(errorMessage(thrown)).toBe("Soft cap not reached");
    });

    it("reads ethers' reason field", () => {
      expect(errorMessage({ reason: "Min contribution not reached" })).toBe(
        "Min contribution not reached"
      );
    });
  });

  it("reads an axios response body", () => {
    const thrown = {
      message: "Request failed with status code 400",
      response: { data: { message: "Invalid request" } },
    };

    expect(errorMessage(thrown)).toBe("Invalid request");
  });

  it("never returns an empty string when a fallback is given", () => {
    expect(errorMessage({ message: "   " }, "fallback")).toBe("fallback");
    expect(errorMessage({ message: "" }, "fallback")).toBe("fallback");
  });
});

describe("isUserRejection", () => {
  /**
   * Dismissing a wallet prompt is a choice, not a failure, and must not be
   * reported to the user as an error.
   */
  it("recognises the EIP-1193 rejection code", () => {
    expect(isUserRejection({ code: USER_REJECTED_CODE })).toBe(true);
  });

  it("recognises the code on a nested error", () => {
    expect(isUserRejection({ error: { code: USER_REJECTED_CODE } })).toBe(true);
  });

  it.each([
    "User rejected the request",
    "MetaMask Tx Signature: User denied transaction signature",
  ])("recognises %p by message", (message) => {
    expect(isUserRejection(new Error(message))).toBe(true);
  });

  it("does not mistake a real failure for a rejection", () => {
    expect(isUserRejection(new Error("insufficient funds"))).toBe(false);
    expect(isUserRejection(null)).toBe(false);
  });
});

describe("isUnrecognisedChain", () => {
  it("recognises the unknown-chain code", () => {
    expect(isUnrecognisedChain({ code: UNRECOGNISED_CHAIN_CODE })).toBe(true);
    expect(isUnrecognisedChain({ error: { code: UNRECOGNISED_CHAIN_CODE } })).toBe(
      true
    );
  });

  it("returns false for anything else", () => {
    expect(isUnrecognisedChain({ code: 4001 })).toBe(false);
    expect(isUnrecognisedChain(null)).toBe(false);
  });
});

describe("toastableError", () => {
  it("stays silent for a user rejection", () => {
    expect(toastableError({ code: USER_REJECTED_CODE })).toBe("");
  });

  it("reports a real failure", () => {
    expect(
      toastableError(new Error("execution reverted: revert: Hardcap reached"))
    ).toBe("Hardcap reached");
  });
});
