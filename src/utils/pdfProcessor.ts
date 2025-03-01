import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import type { LogEventCurriedProps } from "./logService";

const execAsync = promisify(exec);

export async function processPDF({
  inputPath,
  compress,
  options,
}: {
  inputPath: string;
  compress: boolean;
  options?: {
    logEventFn?: (props: LogEventCurriedProps) => Promise<void>;
  };
}): Promise<Buffer> {
  const fileBuffer = await fs.promises.readFile(inputPath);
  const MIN_SIZE = 50 * 1024; // 500KB threshold

  if (compress && fileBuffer.length > MIN_SIZE) {
    console.log("Compressing PDF using Ghostscript...");
    if (options?.logEventFn) {
      await options?.logEventFn({
        status: "processing",
        message: "Compressing PDF using Ghostscript...",
      });
    }
    const outputFileName = `compressed-${path.basename(inputPath)}`;
    const outputPath = path.join(os.tmpdir(), outputFileName);
    const command = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/screen -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;
    try {
      const { stderr } = await execAsync(command);
      if (stderr) {
        console.error("Ghostscript reported:", stderr);
        if (options?.logEventFn) {
          await options?.logEventFn({
            status: "warning",
            message: "Ghostscript reported: " + stderr,
          });
        }
      }
      const compressedBuffer = await fs.promises.readFile(outputPath);
      await fs.promises.unlink(outputPath);
      return compressedBuffer;
    } catch (error) {
      console.error("Error during PDF compression:", (error as Error).message);
      if (options?.logEventFn) {
        await options?.logEventFn({
          status: "warning",
          message: "Error during PDF compression: " + (error as Error).message,
          error: (error as Error).stack,
        });
      }
      return fileBuffer;
    }
  } else {
    console.log("Skipping PDF compression.");
    if (options?.logEventFn) {
      await options?.logEventFn({
        status: "warning",
        message: "Skipping PDF compression.",
      });
    }
    return fileBuffer;
  }
}
