export async function getAssetType(
  url: string
): Promise<"image" | "video" | "pdf" | "unknown"> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.startsWith("image/")) {
      return "image";
    }
    if (contentType.startsWith("video/")) {
      return "video";
    }
    if (contentType === "application/pdf") {
      return "pdf";
    }
    return "unknown";
  } catch (error) {
    console.error("Error fetching asset type:", (error as Error).message);
    return "unknown";
  }
}
