import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  recordDisconnect,
  resetDisconnect,
  isDisconnectTripped,
  recordBackendFailure,
  recordBackendSuccess,
  isBackendDown,
  resetAll,
} from "../src/circuit-breaker.js";

const BOT = "test-bot";

beforeEach(() => {
  resetAll(BOT);
});

describe("circuit-breaker", () => {
  describe("disconnect breaker", () => {
    it("does not trip below threshold", () => {
      for (let i = 0; i < 4; i++) {
        const result = recordDisconnect(BOT);
        assert.equal(result.tripped, false);
      }
      assert.equal(isDisconnectTripped(BOT), false);
    });

    it("trips at threshold", () => {
      for (let i = 0; i < 4; i++) recordDisconnect(BOT);
      const result = recordDisconnect(BOT);
      assert.equal(result.tripped, true);
      assert.match(result.reason, /5 disconnects/);
      assert.equal(isDisconnectTripped(BOT), true);
    });

    it("resetDisconnect clears breaker", () => {
      for (let i = 0; i < 5; i++) recordDisconnect(BOT);
      assert.equal(isDisconnectTripped(BOT), true);
      resetDisconnect(BOT);
      assert.equal(isDisconnectTripped(BOT), false);
    });

    it("tracks per-bot independently", () => {
      for (let i = 0; i < 5; i++) recordDisconnect(BOT);
      assert.equal(isDisconnectTripped(BOT), true);
      assert.equal(isDisconnectTripped("bot-2"), false);
    });
  });

  describe("backend breaker", () => {
    it("does not trip below threshold", () => {
      for (let i = 0; i < 9; i++) {
        const tripped = recordBackendFailure(BOT);
        assert.equal(tripped, false);
      }
      assert.equal(isBackendDown(BOT), false);
    });

    it("trips at threshold", () => {
      for (let i = 0; i < 9; i++) recordBackendFailure(BOT);
      const tripped = recordBackendFailure(BOT);
      assert.equal(tripped, true);
      assert.equal(isBackendDown(BOT), true);
    });

    it("recordBackendSuccess resets breaker", () => {
      for (let i = 0; i < 10; i++) recordBackendFailure(BOT);
      assert.equal(isBackendDown(BOT), true);
      recordBackendSuccess(BOT);
      assert.equal(isBackendDown(BOT), false);
    });

    it("resetAll clears both breakers", () => {
      for (let i = 0; i < 5; i++) recordDisconnect(BOT);
      for (let i = 0; i < 10; i++) recordBackendFailure(BOT);
      assert.equal(isDisconnectTripped(BOT), true);
      assert.equal(isBackendDown(BOT), true);
      resetAll(BOT);
      assert.equal(isDisconnectTripped(BOT), false);
      assert.equal(isBackendDown(BOT), false);
    });
  });
});
