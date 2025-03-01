import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { promises as fs } from "fs";
import type { LogEventCurriedProps } from "./logService";

interface CropParams {
  x: number; // in pixels
  y: number; // in pixels
  width: number; // in pixels
  height: number; // in pixels
}

interface TrimParams {
  start: number; // start time in seconds
  end: number; // end time in seconds
}

function getVideoDimensions(
  inputPath: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(
        (stream) => stream.codec_type === "video"
      );
      if (!videoStream || !videoStream.width || !videoStream.height) {
        return reject(new Error("Could not determine video dimensions"));
      }
      resolve({ width: videoStream.width, height: videoStream.height });
    });
  });
}

function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format?.duration;
      if (typeof duration !== "number") {
        return reject(new Error("Could not determine video duration"));
      }
      resolve(duration);
    });
  });
}

export async function processVideo({
  inputPath,
  cropParams,
  trimParams,
  compression,
  options,
}: {
  inputPath: string;
  cropParams?: CropParams | null;
  trimParams?: TrimParams | null;
  compression: boolean;
  options?: {
    logEventFn?: (props: LogEventCurriedProps) => Promise<void>;
  };
}): Promise<string> {
  // Define minimum file size (in bytes) for compression (e.g., 1.5 MB)
  const MIN_SIZE = 1.5 * 1024 * 1024;

  // Hard-coded output folder for videos.
  const outputFolder = path.join(process.cwd(), "processed");
  await fs.mkdir(outputFolder, { recursive: true });
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputFolder, `compressed-${baseName}.mp4`);

  // Validate cropping parameters against video dimensions if provided.
  let validCrop = false;
  if (cropParams) {
    try {
      const { width: vidWidth, height: vidHeight } = await getVideoDimensions(
        inputPath
      );
      if (
        cropParams.x < 0 ||
        cropParams.y < 0 ||
        cropParams.x + cropParams.width > vidWidth ||
        cropParams.y + cropParams.height > vidHeight
      ) {
        console.error(
          `Crop parameters (${cropParams.x}, ${cropParams.y}, ${cropParams.width}, ${cropParams.height}) exceed video dimensions (${vidWidth} x ${vidHeight}). Proceeding without cropping (using full video).`
        );
        if (options?.logEventFn) {
          await options.logEventFn({
            status: "warning",
            message: `Crop parameters (${cropParams.x}, ${cropParams.y}, ${cropParams.width}, ${cropParams.height}) exceed video dimensions (${vidWidth} x ${vidHeight}). Proceeding without cropping (using full video).`,
          });
        }
      } else {
        validCrop = true;
      }
    } catch (error) {
      console.error(
        "Error retrieving video dimensions:",
        (error as Error).message
      );
      if (options?.logEventFn) {
        await options.logEventFn({
          status: "warning",
          message:
            "Error retrieving video dimensions: " + (error as Error).message,
          error: (error as Error).stack,
        });
      }
      // In case of error, skip cropping.
    }
  }

  // Validate trimming parameters if provided.
  let validTrim = false;
  if (trimParams) {
    try {
      const videoDuration = await getVideoDuration(inputPath);
      if (
        trimParams.start < 0 ||
        trimParams.end > videoDuration ||
        trimParams.start >= trimParams.end
      ) {
        console.error(
          `Trim parameters (start: ${trimParams.start}, end: ${trimParams.end}) are invalid. Video duration is ${videoDuration} seconds. Proceeding without trimming.`
        );
        if (options?.logEventFn) {
          await options.logEventFn({
            status: "warning",
            message: `Trim parameters (start: ${trimParams.start}, end: ${trimParams.end}) are invalid. Video duration is ${videoDuration} seconds. Proceeding without trimming.`,
          });
        }
      } else {
        validTrim = true;
      }
    } catch (error) {
      console.error(
        "Error retrieving video duration:",
        (error as Error).message
      );
      if (options?.logEventFn) {
        await options.logEventFn({
          status: "warning",
          message:
            "Error retrieving video duration: " + (error as Error).message,
          error: (error as Error).stack,
        });
      }
      // In case of error, skip trimming.
    }
  }

  return new Promise(async (resolve, reject) => {
    let ffmpegCommand = ffmpeg(inputPath).videoCodec("libx264");

    // Apply trimming if valid trimming parameters are provided.
    if (trimParams && validTrim) {
      const { start, end } = trimParams;
      const duration = end - start;
      ffmpegCommand = ffmpegCommand.setStartTime(start).setDuration(duration);
    } else {
      if (trimParams) {
        console.error("Trimming skipped due to invalid trim parameters.");
        if (options?.logEventFn) {
          await options.logEventFn({
            status: "warning",
            message: "Trimming skipped due to invalid trim parameters.",
          });
        }
      }
    }

    // Apply cropping if valid cropping parameters are provided.
    if (cropParams && validCrop) {
      const { x, y, width, height } = cropParams;
      ffmpegCommand = ffmpegCommand.videoFilters(
        `crop=${width}:${height}:${x}:${y}`
      );
    } else {
      if (cropParams) {
        console.error("Cropping skipped due to invalid crop parameters.");
        if (options?.logEventFn) {
          await options.logEventFn({
            status: "warning",
            message: "Cropping skipped due to invalid crop parameters.",
          });
        }
      }
    }

    // Scale the video to 640 pixels wide (maintaining aspect ratio).
    ffmpegCommand = ffmpegCommand.size("640x?");

    // Check file size and conditionally apply compression.
    try {
      const stats = await fs.stat(inputPath);
      if (compression && stats.size > MIN_SIZE) {
        ffmpegCommand = ffmpegCommand.outputOptions("-crf 32");
      } else {
        console.log("Skipping compression due to file size threshold.");
        if (options?.logEventFn) {
          await options.logEventFn({
            status: "processing",
            message: "Skipping compression due to file size threshold.",
          });
        }
      }
    } catch (error) {
      console.error(
        "Error retrieving file size, proceeding without compression",
        error
      );
      if (options?.logEventFn) {
        await options.logEventFn({
          status: "warning",
          message: "Error retrieving file size, proceeding without compression",
          error: (error as Error).stack,
        });
      }
    }

    ffmpegCommand
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}
