import { defineTool } from "../define-tool.js";
import {
  BRIEF_VERSION,
  compileConfirmedStory,
  createReviewQuestion,
  normalizeClarifyingQuestions,
  normalizeHumanAnswers,
  readReviewDecision,
  renderCreativeBrief,
  resolveInteractiveOptions,
} from "../interactive/creative-brief.js";
import { renderJson } from "../renderers/json.js";

function userQuestionsService(ctx) {
  const service = typeof ctx?.get === "function" ? ctx.get("userQuestions") : ctx?.userQuestions;
  if (!service || typeof service.ask !== "function") {
    throw new Error("reca_create_video_interactive requires an active userQuestions provider");
  }
  return service;
}

function requireLiveCaller(exec) {
  if (!exec?.agent) {
    throw new Error("reca_create_video_interactive requires the exact live calling root agent");
  }
  if (exec.signal?.aborted) {
    throw new Error("reca_create_video_interactive was aborted before approval");
  }
  return exec.agent;
}

function clarificationRequest(question) {
  return {
    id: question.id,
    question: question.question,
    ...(question.header !== undefined ? { header: question.header } : {}),
    ...(question.options !== undefined ? { options: question.options } : {}),
    ...(question.multi_select !== undefined ? { multiSelect: question.multi_select } : {}),
  };
}

function briefSchema() {
  return {
    type: "object",
    required: true,
    additionalProperties: false,
    properties: {
      story_goal: { type: "string", required: true },
      audience: { type: "string" },
      visual_style: { type: "string" },
      character_lock: { type: "string" },
      scene_logic: { type: "string" },
      camera_rhythm: { type: "string" },
      audio: {
        type: "object",
        additionalProperties: false,
        properties: {
          dialogue: { type: "string" },
          bgm: { type: "string" },
          sfx: { type: "string" },
        },
      },
      must_have: { type: "array", items: { type: "string" } },
      must_avoid: { type: "array", items: { type: "string" } },
    },
  };
}

function questionsSchema() {
  return {
    type: "array",
    maxItems: 3,
    description: "At most three missing preferences that materially affect the result.",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string", required: true },
        header: { type: "string" },
        question: { type: "string", required: true },
        options: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string", required: true },
              description: { type: "string" },
            },
          },
        },
        multi_select: { type: "boolean" },
      },
    },
  };
}

function referenceImagesSchema() {
  return {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        url: { type: "string" },
        path: { type: "string" },
        role: { type: "string" },
        name: { type: "string" },
      },
    },
  };
}

export function registerCreateVideoInteractive(ctx, client) {
  return ctx.tools.register(defineTool({
    name: "reca_create_video_interactive",
    description:
      "Interactively refine and review a ReCA Creative Brief before creating a video run. "
      + "Use only when the user asks to be questioned or to approve the brief first.",
    parameters: {
      story: { type: "string", required: true, description: "The original story or video idea." },
      brief: briefSchema(),
      clarifying_questions: questionsSchema(),
      duration: { type: "number", description: "Target duration in seconds." },
      resolution: { type: "string", description: "Target resolution, default 1280x720." },
      aspect_ratio: { type: "string", description: "Target aspect ratio, default 16:9." },
      backend: { type: "string", description: "Video backend, default wan." },
      force_i2v: { type: "boolean", description: "Force hard first-frame I2V; interactive default is false." },
      enable_audit: { type: "boolean", description: "Run visual audit and repair." },
      validate_segments: { type: "boolean", description: "Run segment-level validation." },
      seed: { type: "number", description: "Reproducible render seed." },
      first_frame: { type: "string", description: "Optional first-frame image URL or server-side path." },
      reference_images: referenceImagesSchema(),
      reference_image_urls: {
        type: "array",
        description: "Compatibility form for reference images using URLs or paths.",
        items: { type: "string" },
      },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_args, value) => renderJson(value),
    },
    async execute(args, exec) {
      const agent = requireLiveCaller(exec);
      const userQuestions = userQuestionsService(ctx);
      const questions = normalizeClarifyingQuestions(args.clarifying_questions);
      let answers = [];

      if (questions.length > 0) {
        const response = await userQuestions.ask({
          questions: questions.map(clarificationRequest),
          agent,
          signal: exec.signal,
        });
        answers = normalizeHumanAnswers(questions, response);
      }

      const briefMarkdown = renderCreativeBrief(args, questions, answers);
      const reviewResponse = await userQuestions.ask({
        questions: [createReviewQuestion(briefMarkdown)],
        agent,
        signal: exec.signal,
      });
      const review = readReviewDecision(reviewResponse);

      if (!review.approved) {
        return {
          state: "awaiting_revision",
          interaction: {
            mode: "creative-brief",
            approved: false,
            outcome: "revision_requested",
            brief_version: BRIEF_VERSION,
            feedback: review.feedback,
            human_answers: answers,
            brief_markdown: briefMarkdown,
          },
        };
      }

      if (exec.signal?.aborted) {
        throw new Error("reca_create_video_interactive was aborted before Gateway submission");
      }
      const story = compileConfirmedStory(args, questions, answers);
      const options = resolveInteractiveOptions(args);
      const gatewayResult = await client.createVideo({
        story,
        first_frame: args.first_frame,
        reference_images: args.reference_images,
        reference_image_urls: args.reference_image_urls,
        options,
      }, { signal: exec.signal });

      return {
        ...gatewayResult,
        interaction: {
          mode: "creative-brief",
          approved: true,
          brief_version: BRIEF_VERSION,
        },
      };
    },
  }));
}
