import * as mongoose from "mongoose";

const uri =
  process.env.MONGO_URI ||
  "mongodb+srv://saranshkhulbe7:saranshkhulbe7_@invertory-video-uploade.qwgl9.mongodb.net";
const connectDB = async () => {
  console.log("connection uri", uri);
  try {
    if (uri !== undefined) {
      const conn = await mongoose.connect(uri, {
        autoIndex: true,
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);

      // Graceful shutdown
      process.on("SIGINT", async () => {
        await mongoose.disconnect();
        console.log("MongoDB connection closed", uri);
        process.exit(0);
      });
    }
  } catch (err: any) {
    console.error(`Error mongodb: ${err.message}`);
    process.exit(1);
  }
};

export default connectDB;
