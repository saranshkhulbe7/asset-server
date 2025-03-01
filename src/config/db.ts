import * as mongoose from "mongoose";

const connectDB = async () => {
  console.log("connection uri", process.env.MONGO_URI);
  try {
    if (process.env.MONGO_URI !== undefined) {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        autoIndex: true,
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);

      // Graceful shutdown
      process.on("SIGINT", async () => {
        await mongoose.disconnect();
        console.log("MongoDB connection closed", process.env.MONGO_URI);
        process.exit(0);
      });
    }
  } catch (err: any) {
    console.error(`Error mongodb: ${err.message}`);
    process.exit(1);
  }
};

export default connectDB;
