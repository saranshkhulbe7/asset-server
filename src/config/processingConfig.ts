export type AssetType = "image" | "video" | "pdf";

export interface ImageProcessingOptions {
  // Optional cropping parameters (in pixels)
  cropParams?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Whether to compress the image (if above a minimum size)
  compress?: boolean;
  // Optional resize dimensions
  resize?: {
    width?: number;
    height?: number;
  };
}

export interface VideoProcessingOptions {
  // Optional trimming parameters (in seconds)
  trimParams?: {
    start: number;
    end: number;
  };
  // Optional cropping parameters (in pixels)
  cropParams?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Whether to compress the video (if above a minimum size)
  compression?: boolean;
}
export interface PDFProcessingOptions {
  // Whether to compress the PDF
  compress?: boolean;
}

export type ProcessingOptions =
  | ImageProcessingOptions
  | VideoProcessingOptions
  | PDFProcessingOptions;

export interface ProcessingConfig {
  type: AssetType;
  options?: ProcessingOptions;
}
