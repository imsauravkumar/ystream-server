import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true },
    title: { type: String, required: true },
    channelTitle: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    duration: { type: String, default: "" },
    addedBy: {
      uid: String,
      name: String,
      photoURL: String
    }
  },
  { _id: false }
);

const playbackSchema = new mongoose.Schema(
  {
    isPlaying: { type: Boolean, default: false },
    timestamp: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const participantSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true },
    name: { type: String, required: true },
    photoURL: { type: String, default: "" },
    socketId: { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    hostUid: { type: String, required: true },
    playbackControllerUids: { type: [String], default: [] },
    currentVideo: { type: videoSchema, default: null },
    queue: { type: [videoSchema], default: [] },
    playback: { type: playbackSchema, default: () => ({}) },
    participants: { type: [participantSchema], default: [] },
    messages: {
      type: [
        {
          id: String,
          text: String,
          user: {
            uid: String,
            name: String,
            photoURL: String
          },
          createdAt: Date
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model("Room", roomSchema);
