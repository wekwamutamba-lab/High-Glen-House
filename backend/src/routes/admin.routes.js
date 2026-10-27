import express from "express";
import {
  createStaff,
  listStaff,
  updateStaff,
} from "../controllers/staff.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";

const router = express.Router();

const staffIdParam = z.object({
  id: z.string().uuid("Invalid staff ID format"),
});

router.use(authenticate);
router.use(authorize("ADMIN"));

router.post("/staff", createStaff);
router.get("/staff", listStaff);
router.patch("/staff/:id", validate(staffIdParam), updateStaff);

export default router;