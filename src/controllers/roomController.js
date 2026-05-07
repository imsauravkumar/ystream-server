import Room from "../models/Room.js";
import { generateRoomCode, normalizeRoomCode } from "../utils/roomCode.js";

async function createUniqueCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateRoomCode();
    const exists = await Room.exists({ code });
    if (!exists) return code;
  }
  throw Object.assign(new Error("Could not generate room code."), { statusCode: 500 });
}

export async function createRoom(req, res, next) {
  try {
    const code = await createUniqueCode();
    const room = await Room.create({
      code,
      hostUid: req.user.uid,
      playbackControllerUids: [req.user.uid],
      participants: [
        {
          uid: req.user.uid,
          name: req.user.name || req.user.email || "Host",
          photoURL: req.user.picture || ""
        }
      ]
    });
    res.status(201).json({ room });
  } catch (error) {
    next(error);
  }
}

export async function getRoom(req, res, next) {
  try {
    const code = normalizeRoomCode(req.params.code);
    let room = await Room.findOne({ code });

    if (!room) {
      room = await Room.create({
        code,
        hostUid: req.user.uid,
        playbackControllerUids: [req.user.uid],
        participants: [
          {
            uid: req.user.uid,
            name: req.user.name || req.user.email || "Host",
            photoURL: req.user.picture || ""
          }
        ]
      });
    }

    res.json({ room });
  } catch (error) {
    next(error);
  }
}
