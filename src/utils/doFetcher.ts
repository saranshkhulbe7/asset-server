import fetch from "node-fetch";

export async function downloadFile(signedUrl: string): Promise<Buffer> {
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Failed to download file from signed URL");
  return Buffer.from(await response.arrayBuffer());
}

export async function uploadFile(
  signedUrl: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!response.ok) throw new Error("Failed to upload file to signed URL");
}
