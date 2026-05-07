import { Router } from "express";
import { createRoom, getRoom } from "../controllers/roomController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/databaseReady.js";

const router = Router();

router.post("/", requireAuth, requireDatabase, createRoom);
router.get("/:code", requireAuth, requireDatabase, getRoom);

export default router;
