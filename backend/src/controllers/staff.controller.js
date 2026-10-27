import { prisma } from "../config/prisma.js";
import { Role } from "../generated/prisma/enums.ts";
import { z } from "zod";

const createStaffSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(150),
  email: z.string().email("Invalid email format"),
  firebaseUid: z.string().min(1, "Firebase UID is required"),
  role: z.nativeEnum(Role),
});

const updateStaffSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});

export async function createStaff(req, res) {
  try {
    const { fullName, email, firebaseUid, role } = createStaffSchema.parse(req.body);

    const existingUser = await prisma.appUser.findFirst({
      where: {
        OR: [{ firebaseUid }, { email }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or Firebase UID already exists",
      });
    }

    const staff = await prisma.appUser.create({
      data: {
        schoolId: req.user.schoolId,
        firebaseUid,
        fullName,
        email,
        role,
        isActive: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: staff.id,
        firebaseUid: staff.firebaseUid,
        fullName: staff.fullName,
        email: staff.email,
        role: staff.role,
        isActive: staff.isActive,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: err.errors[0]?.message || "Invalid input",
      });
    }
    throw err;
  }
}

export async function listStaff(req, res) {
  const staff = await prisma.appUser.findMany({
    where: { schoolId: req.user.schoolId },
    select: {
      id: true,
      firebaseUid: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json({
    success: true,
    data: staff,
  });
}

export async function updateStaff(req, res) {
  try {
    const { id } = req.params;
    const { role, isActive } = updateStaffSchema.parse(req.body);

    if (id === req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify your own account",
      });
    }

    const staff = await prisma.appUser.findUnique({
      where: { id },
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    if (staff.schoolId !== req.user.schoolId) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify staff from another school",
      });
    }

    if (isActive === false && id === req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Cannot deactivate your own account",
      });
    }

    const updateData = {};
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.appUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        firebaseUid: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: err.errors[0]?.message || "Invalid input",
      });
    }
    throw err;
  }
}