import { firebaseAuth } from "../config/firebase.js";
import { prisma } from "../config/prisma.js";

export async function verifyFirebaseIdToken(idToken) {
  const decodedToken = await firebaseAuth.verifyIdToken(idToken);
  return decodedToken;
}

export async function findAppUserByFirebaseUid(firebaseUid) {
  return prisma.appUser.findUnique({
    where: { firebaseUid },
    include: { school: true },
  });
}