/** Images larger than this are refused, so a wrong URL cannot fill the disk. */
export const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
export const DOWNLOAD_TIMEOUT_MS = 30_000;

export class DownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DownloadError";
  }
}

export function isDownloadableUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Detects the image format from the file's first bytes, ignoring what the server claims.
 * Only formats the workbench can load from disk are recognized.
 */
export function sniffImageExtension(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    return ".png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return ".jpg";
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
    return ".gif";
  }
  if (startsWith(bytes, [0x42, 0x4d])) {
    return ".bmp";
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return ".webp";
  }
  const head = new TextDecoder().decode(bytes.subarray(0, 1024)).trimStart().toLowerCase();
  if (/^(<\?xml|<svg|<!--)/.test(head) && head.includes("<svg")) {
    return ".svg";
  }
  return null;
}

export interface FetchedImage {
  bytes: Uint8Array;
  extension: string;
}

export async function fetchImage(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<FetchedImage> {
  if (!isDownloadableUrl(url)) {
    throw new DownloadError(`Not an http(s) URL: ${url}`);
  }
  const response = await fetchImpl(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new DownloadError(`HTTP ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_DOWNLOAD_BYTES) {
    throw new DownloadError(`The image is larger than ${MAX_DOWNLOAD_BYTES} bytes`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new DownloadError(`The image is larger than ${MAX_DOWNLOAD_BYTES} bytes`);
  }
  const extension = sniffImageExtension(bytes);
  if (extension === null) {
    throw new DownloadError("The URL did not return a PNG, JPEG, GIF, BMP, SVG or WebP image");
  }
  return { bytes, extension };
}
