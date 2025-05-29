import {
  uploadMetadata,
  fetchMetadata,
  extractContentId,
  metadataUrl,
} from "../../frontend/src/services/metadataService";
import { reloadRuntimeConfig } from "../../frontend/src/utils/runtimeConfig";

const mockPost = jest.fn();
const mockGet = jest.fn();

/**
 * Delegating methods rather than assigned properties: `metadataService`
 * constructs its client at module scope, and the mocked module is required
 * during the import phase - before the `const` spies above are initialised.
 * Reading them inside the method body defers that until a test actually
 * calls one, which is what lets the imports stay at the top of the file.
 */
jest.mock("../../frontend/src/api/axiosService", () => {
  return {
    __esModule: true,
    default: class MockAxiosService {
      post(...args: any[]) {
        return mockPost(...args);
      }

      get(...args: any[]) {
        return mockGet(...args);
      }

      setHeader() {
        /* no-op */
      }
    },
  };
});


/**
 * Off-chain launch metadata.
 *
 * Uploads deliberately go through the DotLaunch API rather than straight to a
 * pinning service: an earlier build shipped a Pinata JWT inside the browser
 * bundle, where anyone could read it. The tests below pin the API-shaped
 * contract, and the tolerant URI parsing that lets records written by older
 * versions of the platform - which stored full gateway URLs rather than bare
 * content ids - still resolve.
 */

const CID = "bafybeigdyrztktx5b5m2y4sogf2hf5uq3wnvpcnj6xn5k2pmjw7z2m4abc";

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

afterEach(() => {
  delete (window as any).__DOTLAUNCH_CONFIG__;
  reloadRuntimeConfig();
});

describe("extractContentId", () => {
  it("returns a bare content id unchanged", () => {
    expect(extractContentId(CID)).toBe(CID);
  });

  it("takes the trailing segment of a gateway URL", () => {
    expect(extractContentId(`https://gateway.pinata.cloud/ipfs/${CID}`)).toBe(CID);
  });

  it("takes the trailing segment of an API storage URL", () => {
    expect(extractContentId(`http://localhost:8888/api/v1/storage/${CID}`)).toBe(CID);
  });

  it("ignores a query string", () => {
    expect(extractContentId(`https://example.invalid/ipfs/${CID}?filename=meta.json`)).toBe(CID);
  });

  it("ignores a trailing slash", () => {
    expect(extractContentId(`https://example.invalid/ipfs/${CID}/`)).toBe(CID);
  });

  it("returns an empty string for an empty URI", () => {
    expect(extractContentId("")).toBe("");
  });

  it("returns an empty string for a missing URI", () => {
    expect(extractContentId(undefined as any)).toBe("");
  });
});

describe("metadataUrl", () => {
  it("joins the configured storage base with the content id", () => {
    (window as any).__DOTLAUNCH_CONFIG__ = {
      storageBaseUrl: "http://localhost:8888/api/v1/storage",
    };
    reloadRuntimeConfig();

    expect(metadataUrl(CID)).toBe(`http://localhost:8888/api/v1/storage/${CID}`);
  });

  it("does not double the separator when the base ends in a slash", () => {
    (window as any).__DOTLAUNCH_CONFIG__ = {
      storageBaseUrl: "http://localhost:8888/api/v1/storage/",
    };
    reloadRuntimeConfig();

    expect(metadataUrl(CID)).toBe(`http://localhost:8888/api/v1/storage/${CID}`);
  });
});

describe("uploadMetadata", () => {
  it("posts the document to the API storage endpoint", async () => {
    mockPost.mockResolvedValue({ data: { cid: CID, url: `/storage/${CID}` } });

    await uploadMetadata({ name: "Nova", description: "A presale" }, "nova");

    expect(mockPost).toHaveBeenCalledWith("/storage", {
      content: { name: "Nova", description: "A presale" },
      name: "nova",
    });
  });

  it("returns the stored content reference", async () => {
    mockPost.mockResolvedValue({ data: { cid: CID, url: `/storage/${CID}` } });

    const stored = await uploadMetadata({ name: "Nova" });

    expect(stored.cid).toBe(CID);
    expect(stored.url).toBe(`/storage/${CID}`);
  });

  it("sends an undefined name when none is given", async () => {
    mockPost.mockResolvedValue({ data: { cid: CID, url: "" } });

    await uploadMetadata({ name: "Nova" });

    expect(mockPost).toHaveBeenCalledWith("/storage", {
      content: { name: "Nova" },
      name: undefined,
    });
  });

  /** A failed upload must surface: the caller cannot mint a URI without one. */
  it("propagates a failure rather than returning a broken reference", async () => {
    mockPost.mockRejectedValue(new Error("storage unavailable"));

    await expect(uploadMetadata({ name: "Nova" })).rejects.toThrow(
      "storage unavailable"
    );
  });
});

describe("fetchMetadata", () => {
  it("resolves a bare content id", async () => {
    mockGet.mockResolvedValue({ data: { name: "Nova" } });

    const document = await fetchMetadata(CID);

    expect(mockGet).toHaveBeenCalledWith(`/storage/${CID}`);
    expect(document).toEqual({ name: "Nova" });
  });

  it("resolves a full gateway URL by its trailing segment", async () => {
    mockGet.mockResolvedValue({ data: { name: "Nova" } });

    await fetchMetadata(`https://gateway.pinata.cloud/ipfs/${CID}`);

    expect(mockGet).toHaveBeenCalledWith(`/storage/${CID}`);
  });

  /**
   * A presale whose metadata has gone missing still has to render from its
   * on-chain fields, so this returns null instead of throwing.
   */
  it("returns null when the document cannot be fetched", async () => {
    mockGet.mockRejectedValue(new Error("404"));

    await expect(fetchMetadata(CID)).resolves.toBeNull();
  });

  it("returns null for an empty URI without calling the API", async () => {
    await expect(fetchMetadata("")).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("returns null for a URI with no usable segment", async () => {
    await expect(fetchMetadata("///")).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
