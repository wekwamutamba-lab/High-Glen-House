import express from "express";
import { setupFirstAdmin, me } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";

const router = express.Router();

const setupSchema = z.object({
  setupSecret: z.string().min(1, "Setup secret is required"),
  schoolName: z.string().min(1, "School name is required").max(150),
  adminFullName: z.string().min(1, "Admin full name is required").max(150),
  adminEmail: z.string().email("Invalid email format"),
  adminFirebaseUid: z.string().min(1, "Firebase UID is required"),
});

router.post("/setup/first-admin", validate(setupSchema), setupFirstAdmin);
router.get("/auth/me", authenticate, me);

export default router;
