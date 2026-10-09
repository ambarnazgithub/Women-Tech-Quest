import mongoose from "mongoose";

const testRecordSchema = new mongoose.Schema(
  {
    task: {
      type: String,
      required: true
    },

    prompt: {
      type: String,
      required: true
    },

    response: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("TestRecord", testRecordSchema);