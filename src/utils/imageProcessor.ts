import sharp from "sharp";
import path from "path";
import { promises as fs } from "fs";
import type { LogEventCurriedProps } from "./logService";

interface CropParams {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function processImage({
  inputPath,
  compress,
  cropParams,
  options,
}: {
  inputPath: string;
  compress?: boolean;
  cropParams?: CropParams;
  options?: {
    logEventFn?: (props: LogEventCurriedProps) => Promise<void>;
  };
}): Promise<string> {
  // Hard-coded output folder for processed images
  const outputFolder = path.join(process.cwd(), "processed");
  await fs.mkdir(outputFolder, { recursive: true });

  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputFolder, `processed-${baseName}.webp`);

  // Initialize Sharp with the input file.
  let image = sharp(inputPath);

  // Validate cropping parameters if provided.
  if (cropParams) {
    const metadata = await image.metadata();
    const imgWidth = metadata.width || 0;
    const imgHeight = metadata.height || 0;

    // Check if the crop rectangle exceeds the actual dimensions.
    if (
      cropParams.x < 0 ||
      cropParams.y < 0 ||
      cropParams.x + cropParams.width > imgWidth ||
      cropParams.y + cropParams.height > imgHeight
    ) {
      console.error(
        `Crop parameters (${cropParams.x}, ${cropParams.y}, ${cropParams.width}, ${cropParams.height}) exceed image dimensions (${imgWidth} x ${imgHeight}). ` +
          `Proceeding without cropping (using full image).`
      );
      if (options?.logEventFn) {
        await options?.logEventFn({
          status: "warning",
          message:
            `Crop parameters (${cropParams.x}, ${cropParams.y}, ${cropParams.width}, ${cropParams.height}) exceed image dimensions (${imgWidth} x ${imgHeight}). ` +
            `Proceeding without cropping (using full image).`,
        });
      }
      // Set cropParams to full image dimensions (i.e., no cropping)
      cropParams = { x: 0, y: 0, width: imgWidth, height: imgHeight };
    }

    // Apply the (validated or overridden) cropping.
    image = image.extract({
      left: cropParams.x,
      top: cropParams.y,
      width: cropParams.width,
      height: cropParams.height,
    });
  }

  // Determine quality based on compression flag and file size.
  const stats = await fs.stat(inputPath);
  const MIN_SIZE = 500 * 1024; // 500KB threshold
  const quality = compress && stats.size > MIN_SIZE ? 60 : 100;

  // Convert the image to WebP format with the determined quality.
  await image.webp({ quality }).toFile(outputPath);

  return outputPath;
}
