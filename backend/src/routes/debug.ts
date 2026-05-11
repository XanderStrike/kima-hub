import { Router, Request, Response } from "express";
import fs from "fs/promises";
import { logger } from "../utils/logger";
import { requireAuth } from "../middleware/auth";

const router = Router();
const LOG_PATH = "/data/ios-debug.log";
const MAX_BYTES = 10 * 1024 * 1024;

router.post("/ios-log", requireAuth, async (req: Request, res: Response) => {
    try {
        const body = req.body;
        if (!body || !Array.isArray(body.events)) {
            res.status(400).json({ success: false, error: "Expected { events: [...] }" });
            return;
        }
        const line =
            JSON.stringify({
                uploadedAt: new Date().toISOString(),
                userId: req.user?.id ?? null,
                userAgent: req.get("user-agent") ?? null,
                events: body.events,
            }) + "\n";
        try {
            const stat = await fs.stat(LOG_PATH);
            if (stat.size > MAX_BYTES) {
                await fs.rename(LOG_PATH, `${LOG_PATH}.1`);
            }
        } catch {
            // file does not exist yet
        }
        await fs.appendFile(LOG_PATH, line, { encoding: "utf8" });
        res.json({ success: true });
    } catch (error: any) {
        logger.error("[DEBUG] ios-log upload failed:", error?.message ?? error);
        res.status(500).json({ success: false, error: "Internal error" });
    }
});

export default router;
