import { firebaseAuth } from "../config/firebase.js";
import { prisma } from "../config/prisma.js";
import { config } from "../config/env.js";
import { Role } from "../generated/prisma/enums.ts";

export async function setupFirstAdmin(req, res) {
  try {
    const { setupSecret, schoolName, adminFullName, adminEmail, adminFirebaseUid } = req.body;

    if (!setupSecret || setupSecret !== config.setupSecret) {
      return res.status(401).json({
        success: false,
        message: "Invalid setup secret",
      });
    }

    const setupStatus = await prisma.setupStatus.findFirst();

    if (setupStatus && setupStatus.completed) {
      return res.status(409).json({
        success: false,
        message: "Initial setup has already been completed",
      });
    }

    const existingAdmin = await prisma.appUser.findFirst({
      where: { role: Role.ADMIN },
    });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "Initial setup has already been completed",
      });
    }

    const school = await prisma.school.create({
      data: { name: schoolName },
    });

    let firebaseUser;
    try {
      firebaseUser = await firebaseAuth.createUser({
        uid: adminFirebaseUid,
        email: adminEmail,
        displayName: adminFullName,
      });
    } catch (err) {
      await prisma.school.delete({ where: { id: school.id } });
      throw err;
    }

    const adminUser = await prisma.appUser.create({
      data: {
        schoolId: school.id,
        firebaseUid: adminFirebaseUid,
        fullName: adminFullName,
        email: adminEmail,
        role: Role.ADMIN,
        isActive: true,
      },
    });

    await prisma.setupStatus.upsert({
      where: { id: setupStatus?.id || "00000000-0000-0000-0000-000000000000" },
      update: { completed: true, completedAt: new Date() },
      create: { completed: true, completedAt: new Date() },
    });

    return res.status(201).json({
      success: true,
      data: {
        school: {
          id: school.id,
          name: school.name,
        },
        admin: {
          id: adminUser.id,
          firebaseUid: adminUser.firebaseUid,
          fullName: adminUser.fullName,
          email: adminUser.email,
          role: adminUser.role,
        },
      },
    });
  } catch (err) {
    if (err.code === "auth/uid-already-exists") {
      return res.status(409).json({
        success: false,
        message: "Firebase user already exists",
      });
    }
    if (err.code === "auth/email-already-exists") {
      return res.status(409).json({
        success: false,
        message: "Firebase email already exists",
      });
    }
    throw err;
  }
}

export async function me(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      id: req.user.id,
      schoolId: req.user.schoolId,
      firebaseUid: req.user.firebaseUid,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      isActive: req.user.isActive,
      school: req.user.school,
    },
  });
}
