import { Log } from "../models/Log";
import { logger } from "./logger";
import chalk from "chalk";

export type LogStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "error"
  | "warning";

export interface LogEventCurriedProps {
  status: LogStatus;
  message: string;
  error?: string; // new field to optionally include error info (e.g. error stack)
}

export async function createLogger({
  requestId,
  source,
  originalUrl,
  processingConfig,
}: {
  requestId: string;
  source: string;
  originalUrl: string;
  processingConfig?: Record<string, any>;
}) {
  // Look for an existing log document for the asset.
  let logDoc = await Log.findOne({ originalUrl });
  if (!logDoc) {
    // If none exists, create one with an empty requests array.
    logDoc = await Log.create({ originalUrl, requests: [] });
  }

  // Check if this request is already recorded.
  const existingRequest = logDoc.requests.find(
    (req) => req.requestId === requestId
  );
  if (!existingRequest) {
    // If not, add a new request entry.
    logDoc.requests.push({ requestId, source, processingConfig, events: [] });
    await logDoc.save();
  }

  // Return a curried function that appends events to this request entry.
  return async function logEventCurried({
    status,
    message,
    error,
  }: LogEventCurriedProps): Promise<void> {
    try {
      const event = {
        status,
        message,
        createdAt: new Date(),
        error: error || null,
      };

      // Push the new event to the specific request's events array.
      await Log.updateOne(
        { originalUrl, "requests.requestId": requestId },
        { $push: { "requests.$.events": event } }
      );

      let coloredMessage;
      if (status === "pending") {
        coloredMessage = chalk.yellow.bold(message);
      } else if (status === "processing") {
        coloredMessage = chalk.blue.bold(message);
      } else if (status === "completed") {
        coloredMessage = chalk.green.bold(message);
      } else {
        coloredMessage = chalk.red.bold(message);
      }

      logger.info(
        `📜 Log saved | ${coloredMessage} | RequestID: ${chalk.magenta(
          requestId
        )} | Source: ${chalk.cyan(source)} | OriginalURL: ${chalk.gray(
          originalUrl
        )} | Status: ${chalk.white.bold(status)}`
      );
    } catch (err) {
      logger.error(
        `❌ Failed to update log | RequestID: ${chalk.magenta(requestId)}`,
        {
          error: (err as Error).message,
          stack: (err as Error).stack,
        }
      );
    }
  };
}
