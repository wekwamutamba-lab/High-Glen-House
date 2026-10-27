import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { config } from "./env.js";

let realFirebaseAuth = null;

function getFirebaseAuth() {
  if (!realFirebaseAuth) {
    let firebaseApp;
    if (getApps().length === 0) {
      firebaseApp = initializeApp({
        credential: cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey,
        }),
      });
    } else {
      firebaseApp = getApps()[0];
    }
    realFirebaseAuth = getAuth(firebaseApp);
  }
  return realFirebaseAuth;
}

// Mutable holder so tests can replace verifyIdToken/createUser without module mocking
export const firebaseAuth = {
  verifyIdToken: async (...args) => getFirebaseAuth().verifyIdToken(...args),
  createUser: async (...args) => getFirebaseAuth().createUser(...args),
};
