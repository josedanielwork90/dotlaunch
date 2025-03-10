/**
 * Backwards-compatible shim.
 *
 * The Pinata SDK used to be instantiated here in the browser, which meant the
 * bundle shipped a storage JWT to every visitor. Uploads now go through the
 * DotLaunch API (see metadataService), which holds the credential server-side
 * and can swap IPFS for local disk via configuration.
 *
 * @deprecated Import from "./metadataService" instead.
 */
import { uploadMetadata, fetchMetadata } from "./metadataService";

/** @deprecated Use uploadMetadata; returns the public URL of the document. */
export const uploadInfoToIPFS = async (jsonObj) => {
  const { url } = await uploadMetadata(jsonObj);
  return url;
};

export { fetchMetadata };
