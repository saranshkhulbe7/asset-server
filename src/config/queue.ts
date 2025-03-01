import amqplib, { type Connection, type Channel } from "amqplib";

const RABBIT_URL = "amqp://localhost";
export const PROCESSING_QUEUE = "asset_processing_queue";

let connection: Connection | null = null;
let channel: Channel | null = null;

export async function connectRabbitMQ(): Promise<Channel> {
  if (channel) return channel;
  connection = await amqplib.connect(RABBIT_URL);
  channel = await connection.createChannel();
  await channel.assertQueue(PROCESSING_QUEUE, { durable: true });
  console.log("Asset Server: connected to RabbitMQ at", RABBIT_URL);
  return channel;
}
