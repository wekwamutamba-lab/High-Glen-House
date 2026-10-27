import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "http";
import { config } from "../src/config/env.js";
import { prisma } from "../src/config/prisma.js";

async function setup() {
  await prisma.$connect();
}

async function teardown() {
  await prisma.$disconnect();
}

describe("Health Endpoint", async (t) => {
  await setup();

  it("should return 200 and healthy status", async () => {
    const app = (await import("../src/app.js")).default;
    const server = createServer(app);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/api/health`, {
      method: "GET",
    });

    const body = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, "ok");

    server.close();
  });

  await teardown();
});
