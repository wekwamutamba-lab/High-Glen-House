import { firebaseAuth } from "../config/firebase.js";
import { prisma } from "../config/prisma.js";

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Missing or invalid authorization header",
      });
    }

    const idToken = authHeader.substring(7);

    let decodedToken;
    try {
      decodedToken = await firebaseAuth.verifyIdToken(idToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Firebase ID token",
      });
    }

    const user = await prisma.appUser.findUnique({
      where: { firebaseUid: decodedToken.uid },
      include: { school: true },
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "No active school account found for this Firebase user",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    req.user = {
      id: user.id,
      schoolId: user.schoolId,
      firebaseUid: user.firebaseUid,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      school: user.school,
    };

    next();
  } catch (err) {
    next(err);
  }
}
