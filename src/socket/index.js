import { Server } from "socket.io";
import Room from "../models/Room.js";
import { verifySocketToken } from "../middleware/auth.js";
import { normalizeRoomCode } from "../utils/roomCode.js";
import { getClientOrigins } from "../config/cors.js";

const activeRooms = new Map();

function publicUser(user) {
  return {
    uid: user.uid,
    name: user.name || user.email || `Guest ${user.uid.slice(0, 5)}`,
    photoURL: user.picture || ""
  };
}

function getActiveUsers(roomCode) {
  return Array.from(activeRooms.get(roomCode)?.values() || []);
}

function hasActiveUser(roomCode, uid) {
  return getActiveUsers(roomCode).some((user) => user.uid === uid);
}

function setActiveUser(roomCode, socketId, user) {
  if (!activeRooms.has(roomCode)) activeRooms.set(roomCode, new Map());
  activeRooms.get(roomCode).set(socketId, user);
}

function removeActiveUser(roomCode, socketId) {
  const room = activeRooms.get(roomCode);
  if (!room) return;
  room.delete(socketId);
  if (!room.size) activeRooms.delete(roomCode);
}

async function findOrCreateRoom(code, user) {
  let room = await Room.findOne({ code });
  if (!room) {
    room = await Room.create({
      code,
      hostUid: user.uid,
      participants: [{ ...user, lastSeenAt: new Date() }]
    });
  }
  return room;
}

async function updateParticipant(room, socketId, user) {
  const participant = room.participants.find((item) => item.uid === user.uid);
  if (participant) {
    participant.name = user.name;
    participant.photoURL = user.photoURL;
    participant.socketId = socketId;
    participant.lastSeenAt = new Date();
  } else {
    room.participants.push({ ...user, socketId, lastSeenAt: new Date() });
  }
  await room.save();
}

function emitRoomState(io, roomCode, room) {
  io.to(roomCode).emit("room-state", {
    room,
    users: getActiveUsers(roomCode)
  });
}

async function transferHostIfNeeded(io, roomCode, leavingUid) {
  const room = await Room.findOne({ code: roomCode });
  if (!room || room.hostUid !== leavingUid || hasActiveUser(roomCode, leavingUid)) return;

  const nextHost = getActiveUsers(roomCode)[0];
  if (!nextHost) return;

  const controllers = new Set(room.playbackControllerUids || []);
  controllers.delete(leavingUid);
  controllers.add(nextHost.uid);

  room.hostUid = nextHost.uid;
  room.playbackControllerUids = Array.from(controllers);
  await room.save();
  emitRoomState(io, roomCode, room);
}

function canControlPlayback(socket, room) {
  return room.hostUid === socket.user.uid || room.playbackControllerUids?.includes(socket.user.uid);
}

function assertHost(socket, room) {
  if (room.hostUid !== socket.user.uid) {
    throw new Error("Only the host can change playback permissions.");
  }
}

function assertPlaybackControl(socket, room) {
  if (!canControlPlayback(socket, room)) {
    throw new Error("You do not have permission to control playback.");
  }
}

function nextPlayback({ isPlaying, timestamp }) {
  return {
    isPlaying,
    timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : 0,
    updatedAt: new Date()
  };
}

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: getClientOrigins(),
      credentials: true
    }
  });

  io.use(verifySocketToken);

  io.on("connection", (socket) => {
    socket.on("join-room", async ({ roomCode, user: clientUser }, callback) => {
      try {
        const code = normalizeRoomCode(roomCode);
        const user = {
          ...publicUser(socket.user),
          name: clientUser?.name || publicUser(socket.user).name,
          photoURL: clientUser?.photoURL || publicUser(socket.user).photoURL
        };
        const room = await findOrCreateRoom(code, user);
        if (!room.playbackControllerUids?.includes(room.hostUid)) {
          room.playbackControllerUids = Array.from(new Set([...(room.playbackControllerUids || []), room.hostUid]));
        }

        socket.join(code);
        socket.data.roomCode = code;
        setActiveUser(code, socket.id, user);
        await updateParticipant(room, socket.id, user);

        emitRoomState(io, code, room);
        callback?.({ ok: true, room });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
        if (!callback) socket.emit("error-message", error.message);
      }
    });

    socket.on("play-video", async ({ roomCode, timestamp }) => {
      try {
        const code = normalizeRoomCode(roomCode);
        const room = await Room.findOne({ code });
        if (!room) return;
        assertPlaybackControl(socket, room);
        room.playback = nextPlayback({ isPlaying: true, timestamp });
        await room.save();
        io.to(code).emit("sync-state", { playback: room.playback, currentVideo: room.currentVideo });
      } catch (error) {
        socket.emit("error-message", error.message);
      }
    });

    socket.on("pause-video", async ({ roomCode, timestamp }) => {
      try {
        const code = normalizeRoomCode(roomCode);
        const room = await Room.findOne({ code });
        if (!room) return;
        assertPlaybackControl(socket, room);
        room.playback = nextPlayback({ isPlaying: false, timestamp });
        await room.save();
        io.to(code).emit("sync-state", { playback: room.playback, currentVideo: room.currentVideo });
      } catch (error) {
        socket.emit("error-message", error.message);
      }
    });

    socket.on("seek-video", async ({ roomCode, timestamp }) => {
      try {
        const code = normalizeRoomCode(roomCode);
        const room = await Room.findOne({ code });
        if (!room) return;
        assertPlaybackControl(socket, room);
        room.playback = nextPlayback({ isPlaying: room.playback.isPlaying, timestamp });
        await room.save();
        io.to(code).emit("sync-state", { playback: room.playback, currentVideo: room.currentVideo });
      } catch (error) {
        socket.emit("error-message", error.message);
      }
    });

    socket.on("change-video", async ({ roomCode, video }) => {
      try {
        const code = normalizeRoomCode(roomCode);
        const room = await Room.findOne({ code });
        if (!room || !video?.videoId) return;
        assertPlaybackControl(socket, room);
        if (room.currentVideo) {
          room.history = [...(room.history || []), room.currentVideo].slice(-25);
        }
        room.currentVideo = { ...video, addedBy: publicUser(socket.user) };
        room.playback = nextPlayback({ isPlaying: true, timestamp: 0 });
        await room.save();
        io.to(code).emit("sync-state", { playback: room.playback, currentVideo: room.currentVideo });
      } catch (error) {
        socket.emit("error-message", error.message);
      }
    });

    socket.on("queue-update", async ({ roomCode, action, video, index }, callback) => {
      try {
        const code = normalizeRoomCode(roomCode);
        const room = await Room.findOne({ code });
        if (!room) {
          callback?.({ ok: false, message: "Room not found." });
          return;
        }

        if (action === "add" && video?.videoId) {
          assertPlaybackControl(socket, room);
          const queuedVideo = { ...video, addedBy: publicUser(socket.user) };
          if (!room.currentVideo) {
            room.currentVideo = queuedVideo;
            room.playback = nextPlayback({ isPlaying: true, timestamp: 0 });
          } else {
            room.queue.push(queuedVideo);
          }
        }

        if (action === "remove") {
          assertPlaybackControl(socket, room);
          const removeIndex = Number(index);
          if (!Number.isInteger(removeIndex) || removeIndex < 0 || removeIndex >= room.queue.length) {
            throw new Error("That queue item is no longer available.");
          }
          room.queue.splice(removeIndex, 1);
        }

        if (action === "next") {
          assertPlaybackControl(socket, room);
          const nextVideo = room.queue.shift();
          if (nextVideo && room.currentVideo) {
            room.history = [...(room.history || []), room.currentVideo].slice(-25);
          }
          room.currentVideo = nextVideo || null;
          room.playback = nextPlayback({ isPlaying: Boolean(nextVideo), timestamp: 0 });
        }

        if (action === "previous") {
          assertPlaybackControl(socket, room);
          const previousVideo = room.history?.pop();
          if (!previousVideo) {
            throw new Error("No previously played song yet.");
          }
          if (room.currentVideo) {
            room.queue.unshift(room.currentVideo);
          }
          room.currentVideo = previousVideo;
          room.playback = nextPlayback({ isPlaying: true, timestamp: 0 });
        }

        if (!["add", "remove", "next", "previous"].includes(action)) {
          throw new Error("Invalid queue action.");
        }

        await room.save();
        io.to(code).emit("queue-update", room.queue);
        io.to(code).emit("sync-state", { playback: room.playback, currentVideo: room.currentVideo });
        callback?.({
          ok: true,
          queue: room.queue,
          playback: room.playback,
          currentVideo: room.currentVideo
        });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
        if (!callback) socket.emit("error-message", error.message);
      }
    });

    socket.on("sync-state", async ({ roomCode, timestamp, isPlaying }) => {
      try {
        const code = normalizeRoomCode(roomCode);
        const room = await Room.findOne({ code });
        if (!room) return;
        assertPlaybackControl(socket, room);
        room.playback = nextPlayback({ isPlaying: Boolean(isPlaying), timestamp });
        await room.save();
        socket.to(code).emit("sync-state", { playback: room.playback, currentVideo: room.currentVideo });
      } catch (error) {
        socket.emit("error-message", error.message);
      }
    });

    socket.on("update-playback-permission", async ({ roomCode, targetUid, allowed }) => {
      try {
        const code = normalizeRoomCode(roomCode);
        const room = await Room.findOne({ code });
        if (!room || !targetUid) return;
        assertHost(socket, room);

        const controllers = new Set([room.hostUid, ...(room.playbackControllerUids || [])]);
        if (allowed) controllers.add(targetUid);
        else if (targetUid !== room.hostUid) controllers.delete(targetUid);

        room.playbackControllerUids = Array.from(controllers);
        await room.save();
        emitRoomState(io, code, room);
      } catch (error) {
        socket.emit("error-message", error.message);
      }
    });

    socket.on("chat-message", async ({ roomCode, text }) => {
      const code = normalizeRoomCode(roomCode);
      const message = {
        id: `${Date.now()}-${socket.id}`,
        text: String(text || "").slice(0, 500),
        user: publicUser(socket.user),
        createdAt: new Date()
      };
      if (!message.text.trim()) return;
      await Room.updateOne({ code }, { $push: { messages: { $each: [message], $slice: -100 } } });
      io.to(code).emit("chat-message", message);
    });

    socket.on("typing", ({ roomCode, isTyping }) => {
      const code = normalizeRoomCode(roomCode);
      socket.data.typing = Boolean(isTyping);
      const names = Array.from(io.sockets.adapter.rooms.get(code) || [])
        .map((socketId) => io.sockets.sockets.get(socketId))
        .filter((client) => client?.data.typing)
        .map((client) => publicUser(client.user).name);
      socket.to(code).emit("typing", names);
    });

    socket.on("reaction", ({ roomCode, emoji }) => {
      const code = normalizeRoomCode(roomCode);
      io.to(code).emit("reaction", {
        emoji: String(emoji || "🔥").slice(0, 8),
        user: publicUser(socket.user)
      });
    });

    socket.on("disconnect", async () => {
      const code = socket.data.roomCode;
      if (!code) return;
      socket.data.typing = false;
      removeActiveUser(code, socket.id);
      const typingNames = Array.from(io.sockets.adapter.rooms.get(code) || [])
        .map((socketId) => io.sockets.sockets.get(socketId))
        .filter((client) => client?.data.typing)
        .map((client) => publicUser(client.user).name);
      socket.to(code).emit("typing", typingNames);
      await Room.updateOne(
        { code, "participants.uid": socket.user.uid },
        {
          $set: {
            "participants.$.lastSeenAt": new Date(),
            "participants.$.socketId": ""
          }
        }
      );
      await transferHostIfNeeded(io, code, socket.user.uid);
      io.to(code).emit("users-update", getActiveUsers(code));
    });
  });

  return io;
}
