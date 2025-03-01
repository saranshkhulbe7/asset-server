import { type Request, type Response } from "express";
import { connectRabbitMQ, PROCESSING_QUEUE } from "../config/queue";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { type AssetManagerRequestBody } from "@saranshkhulbe/types-asset-server";

export async function createAssetJob(req: Request, res: Response) {
  try {
    const { source, originalUrl, overwriteUrl, ...extraOptions } =
      req.body as AssetManagerRequestBody;

    if (!source || !originalUrl || !overwriteUrl) {
      logger.error("❌ Missing required fields");
      console.log({ source, originalUrl, overwriteUrl });
      return res.status(400).json({
        error: "source, originalUrl, and overwriteUrl are required.",
      });
    }

    const requestId = uuidv4();

    const config = {
      requestId,
      source,
      originalUrl,
      overwriteUrl,
      ...extraOptions,
    };

    const channel = await connectRabbitMQ();
    channel.sendToQueue(PROCESSING_QUEUE, Buffer.from(JSON.stringify(config)), {
      persistent: true,
    });

    logger.info(
      `📤 Asset job published to RabbitMQ | Request ID: ${requestId}`
    );
    return res.json({ status: "queued", requestId });
  } catch (err) {
    logger.error("❌ Error in createAssetJob:", {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    return res.status(500).json({ error: "Failed to create asset job" });
  }
}
