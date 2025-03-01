export async function publicAssetExists(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { method: "HEAD" });
    // A successful HEAD is typically 200, 301, or 302.
    // If your bucket enforces redirect for CDNs, handle that as well.
    return resp.ok;
  } catch (error) {
    // Network errors or other issues => treat as "does not exist"
    return false;
  }
}
