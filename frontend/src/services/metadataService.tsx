import AxiosService from "../api/axiosService";
import { runtimeConfig } from "../utils/runtimeConfig";

/**
 * Off-chain metadata for presales and tokens.
 *
 * Presale detail that is too large or too mutable for the chain — logo,
 * description, socials, whitepaper links — is stored off-chain and referenced
 * on-chain by URI.
 *
 * Uploads go through the DotLaunch API rather than to a pinning service
 * directly. That keeps every storage credential server-side (the browser
 * bundle used to ship a Pinata JWT, which was readable by anyone who opened
 * devtools) and means the local filesystem driver can stand in for IPFS with
 * no change here.
 */

const client = new AxiosService(runtimeConfig.apiBaseUrl);

/** Metadata attached to a presale or token at creation time. */
export interface LaunchMetadata {
  name?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  website?: string;
  whitepaper?: string;
  socials?: Partial<Record<"twitter" | "telegram" | "discord" | "github" | "medium", string>>;
  tags?: string[];
  [key: string]: unknown;
}

export interface StoredMetadata {
  /** Content id — a CID on IPFS, a content hash on the local driver. */
  cid: string;
  /** Publicly resolvable URL for the document. */
  url: string;
}

/**
 * Store metadata and return its content reference.
 *
 * The returned `url` is what gets written on-chain as the launchpad's URI.
 */
export const uploadMetadata = async (
  content: LaunchMetadata,
  name?: string
): Promise<StoredMetadata> => {
  const response = await client.post("/storage", { content, name });
  const stored: StoredMetadata = response.data;
  return stored;
};

/**
 * Resolve a metadata URI back to its document.
 *
 * Accepts either a bare content id or a full URL, because URIs recorded by
 * earlier versions of the platform are stored in both shapes. Returns null
 * when the document cannot be found, so a presale with unreachable metadata
 * still renders with its on-chain fields rather than failing the page.
 */
export const fetchMetadata = async (
  uri: string
): Promise<LaunchMetadata | null> => {
  const cid = extractContentId(uri);
  if (!cid) return null;

  try {
    const response = await client.get(`/storage/${cid}`);
    const document: LaunchMetadata = response.data;
    return document;
  } catch (error) {
    return null;
  }
};

/** Trailing path segment of a metadata URI: its content id. */
export const extractContentId = (uri: string): string => {
  if (!uri) return "";
  const withoutQuery = uri.split("?")[0].replace(/\/+$/, "");
  const segments = withoutQuery.split("/");
  return segments[segments.length - 1] || "";
};

/** Public URL for a content id, using the configured storage base. */
export const metadataUrl = (cid: string): string =>
  `${runtimeConfig.storageBaseUrl.replace(/\/$/, "")}/${cid}`;

export default { uploadMetadata, fetchMetadata, extractContentId, metadataUrl };
