import test from "node:test";
import assert from "node:assert/strict";
import { ThreadType } from "zca-js";
import { shouldAcceptMessage, stripMentionPrefix } from "../src/policy.js";

function message(overrides = {}) {
  return {
    isSelf: false,
    type: ThreadType.User,
    threadId: "thread-1",
    data: {
      content: "hello",
      uidFrom: "user-1",
      dName: "User One",
    },
    ...overrides,
  };
}

test("accepts direct text messages", () => {
  const result = shouldAcceptMessage(message(), { name: "Bot" });
  assert.equal(result.accept, true);
  assert.equal(result.text, "hello");
  assert.equal(result.isGroup, false);
});

test("ignores self messages", () => {
  const result = shouldAcceptMessage(message({ isSelf: true }), { name: "Bot" });
  assert.equal(result.accept, false);
});

test("ignores group messages without mention", () => {
  const result = shouldAcceptMessage(
    message({ type: ThreadType.Group, data: { content: "hello" } }),
    { name: "OmniBot" },
  );
  assert.equal(result.accept, false);
  assert.equal(result.reason, "group_not_mentioned");
});

test("accepts group messages with mention and strips prefix", () => {
  const result = shouldAcceptMessage(
    message({ type: ThreadType.Group, data: { content: "@OmniBot hello" } }),
    { name: "OmniBot" },
  );
  assert.equal(result.accept, true);
  assert.equal(result.text, "hello");
});

test("accepts whitelisted group thread", () => {
  const result = shouldAcceptMessage(
    message({ type: ThreadType.Group, threadId: "group-1", data: { content: "hello" } }),
    { name: "OmniBot" },
    { threadWhitelist: ["group-1"] },
  );
  assert.equal(result.accept, true);
});

test("stripMentionPrefix preserves non-prefix mentions", () => {
  assert.equal(stripMentionPrefix("hello @OmniBot", "OmniBot"), "hello @OmniBot");
});
