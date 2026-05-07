import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { searchYoutube } from "../controllers/youtubeController.js";

const router = Router();

router.get("/search", requireAuth, searchYoutube);

export default router;
