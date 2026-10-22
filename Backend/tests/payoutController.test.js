const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const mongoose = require("mongoose");

test("approvePayout rejects an invalid payout ID without database access", async () => {
  const controllerPath = require.resolve("../controllers/payoutController");
  const originalLoad = Module._load;

  // Isolate controller dependencies so no real database access occurs.
  Module._load = function (request, parent, isMain) {
    if (parent && parent.filename === controllerPath) {
      if (request.startsWith("../models/")) {
        return new Proxy(
          {},
          {
            get() {
              return () => {
                throw new Error("Database access should not occur in this test");
              };
            },
          }
        );
      }

      if (request === "mongoose") {
        return mongoose;
      }

      if (request === "../services/payoutEligibilityService") {
        return {
          calculateEligibilityDate() {
            throw new Error("Eligibility service should not be called");
          },
        };
      }
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[controllerPath];
    const { approvePayout } = require("../controllers/payoutController");

    let statusCode;
    let responseBody;

    const req = { params: { payoutId: "not-a-valid-id" } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    await approvePayout(req, res);

    assert.equal(statusCode, 400);
    assert.equal(responseBody.success, false);
    assert.equal(responseBody.message, "Invalid payout ID");
  } finally {
    Module._load = originalLoad;
    delete require.cache[controllerPath];
  }
});
