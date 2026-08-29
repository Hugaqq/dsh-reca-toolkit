import assert from "node:assert/strict";

import {
  BRIEF_APPROVE_LABEL,
  BRIEF_REVIEW_ID,
  BRIEF_REVISE_LABEL,
  compileConfirmedStory,
  normalizeClarifyingQuestions,
} from "../src/interactive/creative-brief.js";
import { registerCreateVideoInteractive } from "../src/tools/create-video-interactive.js";

const agent = { id: "root-agent", session: { id: "root-agent" } };

function baseArgs(overrides = {}) {
  return {
    story: "A courier protects a fragile lantern while crossing a flooded night market.",
    brief: {
      story_goal: "Show trust earned under pressure",
      audience: "Young adult adventure viewers",
      visual_style: "ink-wash cyberpunk",
      character_lock: "Mei keeps the same red coat and braided hair in every shot",
      scene_logic: "The river stays east of the market and the bridge remains visible",
      camera_rhythm: "Measured tracking shots; avoid whip pans",
      audio: {
        dialogue: "Mandarin dialogue, calm female lead voice",
        bgm: "Sparse guzheng over low synth pulses",
        sfx: "Rain, footsteps, and one lantern-glass chime",
      },
      must_have: ["The lantern remains intact"],
      must_avoid: ["No aerial spin shots"],
    },
    duration: 48,
    resolution: "secret-resolution-value",
    aspect_ratio: "16:9",
    backend: "secret-backend-route",
    seed: 73,
    first_frame: "https://media.example/first.png",
    reference_images: [{
      url: "https://media.example/mei.png",
      role: "character",
      name: "Mei",
    }],
    ...overrides,
  };
}

function captureTool(provider, client) {
  let tool;
  const ctx = {
    tools: {
      register(value) {
        tool = value;
        return () => {};
      },
    },
    get(name) {
      return name === "userQuestions" ? provider : undefined;
    },
  };
  registerCreateVideoInteractive(ctx, client);
  assert.ok(tool, "interactive tool should register");
  assert.equal(tool.parameters.properties.clarifying_questions.maxItems, 3);
  assert.ok(tool.parameters.required.includes("story"));
  assert.ok(tool.parameters.required.includes("brief"));
  return tool;
}

function exec(signal = new AbortController().signal) {
  return { agent, signal };
}

async function testApprovedFlow() {
  const requests = [];
  const gatewayCalls = [];
  const provider = {
    async ask(request) {
      requests.push(request);
      assert.equal(request.agent, agent);
      assert.ok(request.signal);
      if (requests.length === 1) {
        return {
          answers: [{ id: "sound-focus", selected: ["突出雨声"], custom: "对白保持克制" }],
        };
      }
      assert.equal(gatewayCalls.length, 0, "Gateway must remain untouched while the brief is under review");
      return {
        answers: [{ id: BRIEF_REVIEW_ID, selected: [BRIEF_APPROVE_LABEL] }],
      };
    },
  };
  const client = {
    async createVideo(input, options) {
      gatewayCalls.push({ input, options });
      return { run_id: "abc123def456", state: "queued" };
    },
  };
  const tool = captureTool(provider, client);
  const args = baseArgs({
    clarifying_questions: [{
      id: "sound-focus",
      header: "声音设计",
      question: "雨声与对白哪个更突出？",
      options: [{ label: "突出雨声", description: "强化环境压力" }],
      multi_select: true,
    }],
  });
  const result = await tool.execute(args, exec());

  assert.equal(requests.length, 2);
  assert.equal(requests[0].questions.length, 1);
  assert.equal(requests[0].questions[0].multiSelect, true);
  const review = requests[1].questions[0];
  assert.equal(review.id, BRIEF_REVIEW_ID);
  assert.equal(review.intent.kind, "plan-review");
  assert.equal(review.intent.approve, BRIEF_APPROVE_LABEL);
  assert.match(review.detail, /声音设计/);
  assert.match(review.detail, /Mei keeps the same red coat/);
  assert.match(review.detail, /river stays east/);
  assert.match(review.detail, /Measured tracking shots/);
  assert.match(review.detail, /突出雨声/);

  assert.equal(gatewayCalls.length, 1, "approval should submit exactly once");
  const payload = gatewayCalls[0].input;
  assert.equal(payload.options.force_i2v, false);
  assert.equal(payload.options.backend, "secret-backend-route");
  assert.equal(payload.options.resolution, "secret-resolution-value");
  assert.deepEqual(payload.reference_images, args.reference_images);
  assert.match(payload.story, /\[ORIGINAL STORY\]/);
  assert.match(payload.story, /\[AUDIO INTENT\]/);
  assert.match(payload.story, /对白保持克制/);
  assert.match(payload.story, /Mei \[role: character\]/);
  assert.doesNotMatch(payload.story, /secret-backend-route/);
  assert.doesNotMatch(payload.story, /secret-resolution-value/);
  assert.doesNotMatch(payload.story, /seed[^\n]*73/i);
  assert.equal(gatewayCalls[0].options.signal.aborted, false);
  assert.equal(result.run_id, "abc123def456");
  assert.deepEqual(result.interaction, {
    mode: "creative-brief",
    approved: true,
    brief_version: 1,
  });
}

async function testRevisionDoesNotSubmit() {
  const gatewayCalls = [];
  const provider = {
    async ask() {
      return {
        answers: [{
          id: BRIEF_REVIEW_ID,
          selected: [BRIEF_REVISE_LABEL],
          custom: "把结尾改成开放式",
        }],
      };
    },
  };
  const tool = captureTool(provider, {
    async createVideo(input) {
      gatewayCalls.push(input);
      return {};
    },
  });
  const result = await tool.execute(baseArgs(), exec());
  assert.equal(gatewayCalls.length, 0);
  assert.equal(result.state, "awaiting_revision");
  assert.equal(result.interaction.approved, false);
  assert.equal(result.interaction.feedback, "把结尾改成开放式");
  assert.match(result.interaction.brief_markdown, /ReCA Creative Brief/);
}

async function testFailurePathsDoNotSubmit() {
  const calls = [];
  const client = {
    async createVideo(input) {
      calls.push(input);
      return {};
    },
  };
  const noProviderTool = captureTool(undefined, client);
  await assert.rejects(
    noProviderTool.execute(baseArgs(), exec()),
    /active userQuestions provider/,
  );
  assert.equal(calls.length, 0);

  const delegatedTool = captureTool({
    async ask() {
      const error = new Error("human interaction is unavailable for a delegated caller");
      error.code = "DELEGATED_CALLER";
      throw error;
    },
  }, client);
  await assert.rejects(
    delegatedTool.execute(baseArgs(), exec()),
    /delegated caller/,
  );
  assert.equal(calls.length, 0);

  for (const [code, message] of [
    ["ASK_CANCELLED", "the user dismissed the review"],
    ["ASK_ABORTED", "the turn was aborted while waiting"],
  ]) {
    const waitingTool = captureTool({
      async ask() {
        const error = new Error(message);
        error.code = code;
        throw error;
      },
    }, client);
    await assert.rejects(waitingTool.execute(baseArgs(), exec()), new RegExp(message));
    assert.equal(calls.length, 0);
  }

  const controller = new AbortController();
  controller.abort();
  const abortedTool = captureTool({ async ask() { return { answers: [] }; } }, client);
  await assert.rejects(
    abortedTool.execute(baseArgs(), exec(controller.signal)),
    /aborted before approval/,
  );
  assert.equal(calls.length, 0);
}

async function testGatewayFailureIsSingleShot() {
  let calls = 0;
  const tool = captureTool({
    async ask() {
      return { answers: [{ id: BRIEF_REVIEW_ID, selected: [BRIEF_APPROVE_LABEL] }] };
    },
  }, {
    async createVideo() {
      calls += 1;
      throw new Error("Gateway unavailable");
    },
  });
  await assert.rejects(tool.execute(baseArgs(), exec()), /Gateway unavailable/);
  assert.equal(calls, 1);
}

function testQuestionAndPromptContracts() {
  assert.throws(
    () => normalizeClarifyingQuestions(Array.from({ length: 4 }, (_, index) => ({
      id: `q${index}`,
      question: `Question ${index}`,
    }))),
    /more than 3/,
  );
  assert.throws(
    () => normalizeClarifyingQuestions([
      { id: "duplicate", question: "One" },
      { id: "duplicate", question: "Two" },
    ]),
    /duplicated/,
  );
  const story = compileConfirmedStory(baseArgs(), [], []);
  assert.doesNotMatch(story, /secret-backend-route/);
  assert.doesNotMatch(story, /secret-resolution-value/);
  assert.match(story, /Mei \[role: character\]/);
}

await testApprovedFlow();
await testRevisionDoesNotSubmit();
await testFailurePathsDoNotSubmit();
await testGatewayFailureIsSingleShot();
testQuestionAndPromptContracts();

console.log("test-interactive-tool ok");
