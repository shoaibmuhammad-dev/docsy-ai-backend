import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is not defined");
    }

    await mongoose.connect(mongoUri);

    console.log("Database connected");
  } catch (error) {
    if (error instanceof Error) {
      console.error("DB connection error: ", error.message);
    } else {
      console.error(error);
    }
  }
};

export default connectDB;
