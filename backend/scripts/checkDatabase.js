import { prisma } from "../src/config/prisma.js";

try {
  await prisma.$connect();

  const schoolCount = await prisma.school.count();

  console.log("PostgreSQL connection successful.");
  console.log(`Schools currently stored: ${schoolCount}`);
} catch (error) {
  console.error("Database check failed:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}