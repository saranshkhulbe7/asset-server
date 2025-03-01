// asset-server/src/worker.ts
import { connectRabbitMQ, PROCESSING_QUEUE } from "./config/queue";
import fs from "fs";
import os from "os";
import path from "path";
import { downloadFile, uploadFile } from "./utils/doFetcher";
import { processImage } from "./utils/imageProcessor";
import { processVideo } from "./utils/videoProcessor";
import { processPDF } from "./utils/pdfProcessor";
import { createLogger, type LogEventCurriedProps } from "./utils/logService";
import { logger } from "./utils/logger";
import connectDB from "./config/db";
import { publicAssetExists } from "./utils/public-asset-exists";
import { getAssetType } from "./utils/getAssetType";
import type { AssetManagerRequestBody } from "@saranshkhulbe/types-asset-server";

// Connect to the database.
await connectDB();

function getContentType(assetType: string): string {
  switch (assetType) {
    case "image":
      return "image/jpeg";
    case "video":
      return "video/mp4";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

async function processAsset(
  assetType: string,
  inputPath: string,
  assetConfig: AssetManagerRequestBody["assetConfig"],
  options?: {
    logEventFn?: (props: LogEventCurriedProps) => Promise<void>;
  }
): Promise<string> {
  if (assetType === "image" && assetConfig.hasOwnProperty("imageProps")) {
    const imageProps = assetConfig?.imageProps;
    return await processImage({
      inputPath,
      compress: imageProps?.compress,
      cropParams: imageProps?.cropParams,
      options: {
        logEventFn: options?.logEventFn,
      },
    });
  } else if (
    assetType === "video" &&
    assetConfig.hasOwnProperty("videoProps")
  ) {
    const videoProps = assetConfig?.videoProps;
    return await processVideo({
      inputPath,
      cropParams: videoProps?.cropParams,
      trimParams: videoProps?.trimParams,
      compression: videoProps?.compression,
      options: {
        logEventFn: options?.logEventFn,
      },
    });
  } else if (assetType === "pdf" && assetConfig.hasOwnProperty("pdfProps")) {
    const pdfProps = assetConfig?.pdfProps;
    const buffer = await processPDF({
      inputPath,
      compress: pdfProps?.compress,
      options: {
        logEventFn: options?.logEventFn,
      },
    });
    const tempDir = path.join(os.tmpdir(), "asset-worker");
    const outPath = path.join(tempDir, `processed-pdf-${Date.now()}.pdf`);
    await fs.promises.writeFile(outPath, buffer);
    return outPath;
  } else {
    throw new Error("Unsupported asset type: " + assetType);
  }
}

async function processMessage(msgContent: Buffer): Promise<void> {
  let msg: AssetManagerRequestBody & { requestId: string };

  try {
    msg = JSON.parse(msgContent.toString());
    if (!msg.source || !msg.originalUrl || !msg.requestId) {
      throw new Error(
        "Missing required fields: source, originalUrl, or requestId"
      );
    }
  } catch (error) {
    logger.error("❌ Message parsing failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return;
  }
  const { requestId, source, originalUrl, overwriteUrl, assetConfig } = msg;
  const assetType = await getAssetType(originalUrl);
  if (assetType === "unknown") {
    logger.error(`❌ Could not determine asset type for URL: ${originalUrl}`);
    return;
  }

  // Create a log entry (or update existing) for this asset using its originalUrl.
  // The new request entry will include requestId, source, and processingConfig.
  const logEvent = await createLogger({
    requestId,
    source,
    originalUrl,
    processingConfig: assetConfig,
  });

  await logEvent({
    status: "pending",
    message: "Processing started",
  });

  const tempDir = path.join(os.tmpdir(), "asset-worker");
  fs.mkdirSync(tempDir, { recursive: true });
  const inputPath = path.join(tempDir, `input-${Date.now()}`);

  // Step 1: Download the asset.
  try {
    const fileBuffer = await downloadFile(originalUrl);
    fs.writeFileSync(inputPath, fileBuffer);
    await logEvent({
      status: "processing",
      message: "File downloaded",
    });
    logger.info(
      `✅ File downloaded to ${inputPath} | Request ID: ${requestId}`
    );
  } catch (error) {
    await logEvent({
      status: "failed",
      message: `Download failed: ${(error as Error).message}`,
    });
    throw error;
  }

  // Step 2: Process the asset.
  let processedPath: string;
  try {
    processedPath = await processAsset(assetType, inputPath, assetConfig, {
      logEventFn: logEvent,
    });
    await logEvent({
      status: "processing",
      message: "Processing complete, uploading to DO Spaces",
    });
    logger.info(`✅ Processing complete | Request ID: ${requestId}`);
  } catch (error) {
    await logEvent({
      status: "failed",
      message: `Processing failed: ${(error as Error).message}`,
    });
    throw error;
  }

  // Step 3: Read processed file into a Buffer.
  let processedBuffer: Buffer;
  try {
    processedBuffer = await fs.promises.readFile(processedPath);
  } catch (error) {
    logger.error("❌ Failed to read processed file", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }

  // Step 4: Before uploading, check if the original asset still exists publicly.
  try {
    if (!(await publicAssetExists(originalUrl))) {
      await logEvent({
        status: "completed",
        message: "Original asset deleted by user. Skipping final upload.",
      });
      logger.info(`Skipping upload; asset deleted at ${originalUrl}`);
      return;
    }
    const contentType = getContentType(assetType);
    await uploadFile(overwriteUrl, processedBuffer, contentType);
    await logEvent({
      status: "completed",
      message: "Upload successful",
    });
    logger.info(
      `✅ Uploaded file to ${overwriteUrl} | Request ID: ${requestId}`
    );
  } catch (error) {
    await logEvent({
      status: "failed",
      message: `Upload failed: ${(error as Error).message}`,
    });
    throw error;
  }

  // Step 5: Cleanup temporary files.
  try {
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
      logger.info(`🗑️ Deleted temp input file | Request ID: ${requestId}`);
    } else {
      logger.warn(
        `Temp input file not found for cleanup | Request ID: ${requestId}`
      );
    }

    if (fs.existsSync(processedPath)) {
      fs.unlinkSync(processedPath);
      logger.info(`🗑️ Deleted processed file | Request ID: ${requestId}`);
    } else {
      logger.warn(
        `Processed file not found for cleanup | Request ID: ${requestId}`
      );
    }
  } catch (error) {
    logger.error(`❌ Error during cleanup | Request ID: ${requestId}`, {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
  }
}

async function startWorker(): Promise<void> {
  const channel = await connectRabbitMQ();
  channel.consume(PROCESSING_QUEUE, async (msg) => {
    if (msg) {
      try {
        await processMessage(msg.content);
        channel.ack(msg);
        logger.info(
          `✅ Job acknowledged | Request ID: ${
            JSON.parse(msg.content.toString()).requestId
          }`
        );
      } catch (error) {
        logger.error(
          `❌ Error processing message | Request ID: ${
            JSON.parse(msg.content.toString()).requestId
          }`,
          { stack: (error as Error).stack }
        );
        channel.nack(msg, false, false);
      }
    }
  });
  logger.info("🐳 Worker is waiting for messages...");
}

process.on("uncaughtException", (error) => {
  logger.error("💥 Uncaught Exception:", {
    message: (error as Error).message,
    stack: (error as Error).stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("⚠️ Unhandled Rejection:", { reason });
});

startWorker().catch((err) => {
  logger.error(`🚨 Worker failed to start: ${(err as Error).message}`, {
    stack: (err as Error).stack,
  });
  process.exit(1);
});
