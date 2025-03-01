import mongoose, { Schema, Document } from "mongoose";

export interface IRequestLog {
  requestId: string;
  source: string;
  processingConfig?: object;
  events: {
    status: string;
    message: string;
    createdAt: Date;
    error?: string; // new field to store error stack/message
  }[];
}

export interface ILog extends Document {
  originalUrl: string;
  requests: IRequestLog[];
}

const EventSchema = new Schema(
  {
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "failed",
        "error",
        "warning",
      ],
      required: true,
    },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    error: { type: String, default: null }, // optional error field
  },
  { _id: true }
);

const RequestSchema = new Schema(
  {
    requestId: { type: String, required: true },
    source: { type: String, required: true },
    processingConfig: { type: Object },
    events: [EventSchema],
  },
  { _id: false }
);

const LogSchema = new Schema<ILog>({
  originalUrl: { type: String, required: true, unique: true },
  requests: [RequestSchema],
});

export const Log = mongoose.model<ILog>("Log", LogSchema);
