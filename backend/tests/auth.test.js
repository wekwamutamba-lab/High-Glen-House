import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "http";
import { config } from "../src/config/env.js";
import { prisma } from "../src/config/prisma.js";
import { firebaseAuth } from "../src/config/firebase.js";
import { Role } from "../src/generated/prisma/enums.ts";

const originalVerifyIdToken = firebaseAuth.verifyIdToken;
const originalCreateUser = firebaseAuth.createUser;

let verifyIdTokenMock;
let createUserMock;

async function setup() {
  await prisma.$connect();
  await clearDatabase();
  verifyIdTokenMock = mock.fn();
  createUserMock = mock.fn();
  firebaseAuth.verifyIdToken = verifyIdTokenMock;
  firebaseAuth.createUser = createUserMock;
}

async function teardown() {
  firebaseAuth.verifyIdToken = originalVerifyIdToken;
  firebaseAuth.createUser = originalCreateUser;
  await clearDatabase();
  await prisma.$disconnect();
}

async function clearDatabase() {
  await prisma.setupStatus.deleteMany({});
  await prisma.appUser.deleteMany({});
  await prisma.school.deleteMany({});
}

function makeAuthHeader(token = "fake-id-token") {
  return { Authorization: `Bearer ${token}` };
}

async function startServer(app) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  return { server, port };

describe("Authentication - First Admin Setup", async (t) => {
  await setup();

  it("should reject setup with invalid secret", async () => {
    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(`http://localhost:${port}/api/setup/first-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setupSecret: "wrong-secret",
        schoolName: "Test School",
        adminFullName: "Admin User",
        adminEmail: "admin@test.com",
        adminFirebaseUid: "firebase-uid-123",
      }),
    });

    const body = await response.json();

    assert.strictEqual(response.status, 401);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, "Invalid setup secret");

    server.close();
  });

  it("should create first admin with valid secret", async () => {
    createUserMock.mockImplementation(() =>
      Promise.resolve({ uid: "firebase-uid-123" })
    );

    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(`http://localhost:${port}/api/setup/first-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setupSecret: config.setupSecret,
        schoolName: "Test School",
        adminFullName: "Admin User",
        adminEmail: "admin@test.com",
        adminFirebaseUid: "firebase-uid-123",
      }),
    });

    const body = await response.json();

    assert.strictEqual(response.status, 201);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.school.name, "Test School");
    assert.strictEqual(body.data.admin.email, "admin@test.com");
    assert.strictEqual(body.data.admin.role, "ADMIN");

    server.close();
  });

  it("should reject reuse of setup after completion", async () => {
    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(`http://localhost:${port}/api/setup/first-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        setupSecret: config.setupSecret,
        schoolName: "Test School 2",
        adminFullName: "Admin User 2",
        adminEmail: "admin2@test.com",
        adminFirebaseUid: "firebase-uid-456",
      }),
    });

    const body = await response.json();

    assert.strictEqual(response.status, 409);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, "Initial setup has already been completed");

    server.close();
  });
});

describe("Authentication - GET /api/auth/me", async (t) => {
  await setup();

  let adminToken;
  let adminUser;

  before(async () => {
    verifyIdTokenMock.mockImplementation(() =>
      Promise.resolve({ uid: "firebase-uid-123" })
    );

    const school = await prisma.school.create({
      data: { name: "Test School" },
    });

    adminUser = await prisma.appUser.create({
      data: {
        schoolId: school.id,
        firebaseUid: "firebase-uid-123",
        fullName: "Admin User",
        email: "admin@test.com",
        role: Role.ADMIN,
        isActive: true,
      },
    });

    adminToken = "valid-token";
  });

  it("should return 401 without authorization header", async () => {
    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(`http://localhost:${port}/api/auth/me`, {
      method: "GET",
    });

    const body = await response.json();

    assert.strictEqual(response.status, 401);
    assert.strictEqual(body.success, false);

    server.close();
  });

  it("should return 401 with invalid Firebase token", async () => {
    verifyIdTokenMock.mockImplementation(() =>
      Promise.reject(new Error("Invalid token"))
    );

    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(`http://localhost:${port}/api/auth/me`, {
      method: "GET",
      headers: makeAuthHeader("invalid-token"),
    });

    const body = await response.json();

    assert.strictEqual(response.status, 401);
    assert.strictEqual(body.success, false);

    server.close();
  });

  it("should return 403 for Firebase user without database account", async () => {
    verifyIdTokenMock.mockImplementation(() =>
      Promise.resolve({ uid: "unknown-uid" })
    );

    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(`http://localhost:${port}/api/auth/me`, {
      method: "GET",
      headers: makeAuthHeader("token-for-unknown-user"),
    });

    const body = await response.json();

    assert.strictEqual(response.status, 403);
    assert.strictEqual(body.success, false);

    server.close();
  });

  it("should return user profile for valid token", async () => {
    verifyIdTokenMock.mockImplementation(() =>
      Promise.resolve({ uid: "firebase-uid-123" })
    );

    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(`http://localhost:${port}/api/auth/me`, {
      method: "GET",
      headers: makeAuthHeader(adminToken),
    });

    const body = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.email, "admin@test.com");
    assert.strictEqual(body.data.role, "ADMIN");

    server.close();
  });

  it("should return 403 for deactivated user", async () => {
    await prisma.appUser.update({
      where: { id: adminUser.id },
      data: { isActive: false },
    });

    verifyIdTokenMock.mockImplementation(() =>
      Promise.resolve({ uid: "firebase-uid-123" })
    );

    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(`http://localhost:${port}/api/auth/me`, {
      method: "GET",
      headers: makeAuthHeader(adminToken),
    });

    const body = await response.json();

    assert.strictEqual(response.status, 403);
    assert.strictEqual(body.success, false);

    server.close();
  });

  await teardown();
});

describe("Authentication - Staff Management", async (t) => {
  await setup();

  let adminToken;
  let schoolId;
  let adminId;

  before(async () => {
    verifyIdTokenMock.mockImplementation(() =>
      Promise.resolve({ uid: "firebase-uid-admin" })
    );

    const school = await prisma.school.create({
      data: { name: "Staff Test School" },
    });
    schoolId = school.id;

    const admin = await prisma.appUser.create({
      data: {
        schoolId: school.id,
        firebaseUid: "firebase-uid-admin",
        fullName: "Admin User",
        email: "admin@stafftest.com",
        role: Role.ADMIN,
        isActive: true,
      },
    });
    adminId = admin.id;
    adminToken = "admin-token";
  });

  it("should allow admin to create staff", async () => {
    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(`http://localhost:${port}/api/admin/staff`, {
      method: "POST",
      headers: {
        ...makeAuthHeader(adminToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: "Teacher One",
        email: "teacher1@stafftest.com",
        firebaseUid: "firebase-uid-teacher1",
        role: Role.TEACHER,
      }),
    });

    const body = await response.json();

    assert.strictEqual(response.status, 201);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.email, "teacher1@stafftest.com");
    assert.strictEqual(body.data.role, "TEACHER");

    server.close();
  });

  it("should list staff", async () => {
    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(`http://localhost:${port}/api/admin/staff`, {
      method: "GET",
      headers: makeAuthHeader(adminToken),
    });

    const body = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2);

    server.close();
  });

  it("should reject non-admin from creating staff", async () => {
    const teacherToken = "teacher-token";

    verifyIdTokenMock.mockImplementation(() =>
      Promise.resolve({ uid: "firebase-uid-teacher" })
    );

    await prisma.appUser.create({
      data: {
        schoolId,
        firebaseUid: "firebase-uid-teacher",
        fullName: "Teacher User",
        email: "teacher@stafftest.com",
        role: Role.TEACHER,
        isActive: true,
      },
    });

    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(`http://localhost:${port}/api/admin/staff`, {
      method: "POST",
      headers: {
        ...makeAuthHeader(teacherToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: "New Staff",
        email: "newstaff@stafftest.com",
        firebaseUid: "firebase-uid-newstaff",
        role: Role.ADMIN,
      }),
    });

    const body = await response.json();

    assert.strictEqual(response.status, 403);
    assert.strictEqual(body.success, false);

    server.close();
  });

  it("should allow admin to update staff role", async () => {
    const teacher = await prisma.appUser.create({
      data: {
        schoolId,
        firebaseUid: "firebase-uid-updatable",
        fullName: "Updatable Teacher",
        email: "updatable@stafftest.com",
        role: Role.TEACHER,
        isActive: true,
      },
    });

    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(
      `http://localhost:${port}/api/admin/staff/${teacher.id}`,
      {
        method: "PATCH",
        headers: {
          ...makeAuthHeader(adminToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: Role.BURSAR,
        }),
      }
    );

    const body = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.role, "BURSAR");

    server.close();
  });

  it("should prevent admin from deactivating themselves", async () => {
    const app = (await import("../src/app.js")).default;
    const { server, port } = await startServer(app);

    const response = await fetch(
      `http://localhost:${port}/api/admin/staff/${adminId}`,
      {
        method: "PATCH",
        headers: {
          ...makeAuthHeader(adminToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: false,
        }),
      }
    );

    const body = await response.json();

    assert.strictEqual(response.status, 403);
    assert.strictEqual(body.success, false);

    server.close();
  });

  await teardown();
});
}