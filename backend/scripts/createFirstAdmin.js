import { firebaseAuth } from "../src/config/firebase.js";
import { prisma } from "../src/config/prisma.js";
import { config } from "../src/config/env.js";

async function createFirstAdmin() {
  const setupSecret = process.env.SETUP_SECRET;
  const schoolName = process.env.SCHOOL_NAME || "High Glen House School";
  const adminFullName = process.env.ADMIN_FULL_NAME || "School Administrator";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@highglen.school";
  const adminFirebaseUid = process.env.ADMIN_FIREBASE_UID;

  if (!setupSecret || setupSecret !== config.setupSecret) {
    console.error("Invalid or missing SETUP_SECRET");
    process.exit(1);
  }

  if (!adminFirebaseUid) {
    console.error("ADMIN_FIREBASE_UID is required");
    process.exit(1);
  }

  try {
    const existingAdmin = await prisma.appUser.findFirst({
      where: { role: "ADMIN" },
    });

    if (existingAdmin) {
      console.log("An admin user already exists. Setup already completed.");
      process.exit(0);
    }

    const setupStatus = await prisma.setupStatus.findFirst();
    if (setupStatus?.completed) {
      console.log("Setup already completed.");
      process.exit(0);
    }

    const school = await prisma.school.create({
      data: { name: schoolName },
    });

    console.log(`Created school: ${school.name} (${school.id})`);

    try {
      await firebaseAuth.createUser({
        uid: adminFirebaseUid,
        email: adminEmail,
        displayName: adminFullName,
      });
      console.log(`Created Firebase user: ${adminFirebaseUid}`);
    } catch (err) {
      if (err.code !== "auth/uid-already-exists") {
        await prisma.school.delete({ where: { id: school.id } });
        throw err;
      }
      console.log("Firebase user already exists, continuing...");
    }

    const adminUser = await prisma.appUser.create({
      data: {
        schoolId: school.id,
        firebaseUid: adminFirebaseUid,
        fullName: adminFullName,
        email: adminEmail,
        role: "ADMIN",
        isActive: true,
      },
    });

    console.log(`Created admin user: ${adminUser.fullName} (${adminUser.id})`);

    await prisma.setupStatus.upsert({
      where: {
        id: setupStatus?.id || "00000000-0000-0000-0000-000000000000",
      },
      update: { completed: true, completedAt: new Date() },
      create: { completed: true, completedAt: new Date() },
    });

    console.log("First admin setup completed successfully.");
  } catch (err) {
    console.error("Setup failed:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createFirstAdmin();