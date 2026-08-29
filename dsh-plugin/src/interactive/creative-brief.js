export const BRIEF_REVIEW_ID = "reca-brief-review";
export const BRIEF_APPROVE_LABEL = "批准并生成";
export const BRIEF_REVISE_LABEL = "返回修改";
export const BRIEF_VERSION = 1;

const MAX_CLARIFYING_QUESTIONS = 3;

function text(value, fallback = "未指定") {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

function bulletList(values, fallback = "无") {
  const items = Array.isArray(values)
    ? values.map((value) => text(value, "")).filter(Boolean)
    : [];
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : `- ${fallback}`;
}

function referenceImages(args) {
  const structured = Array.isArray(args.reference_images) ? args.reference_images : [];
  const aliases = Array.isArray(args.reference_image_urls)
    ? args.reference_image_urls.map((url) => ({ url }))
    : [];
  return [...structured, ...aliases].map((entry, index) => ({
    source: text(entry?.url || entry?.path, "未提供路径"),
    role: text(entry?.role, "未指定角色"),
    name: text(entry?.name, `参考图 ${index + 1}`),
  }));
}

function referenceMarkdown(args) {
  const references = referenceImages(args);
  if (references.length === 0) return "- 无";
  return references
    .map((entry) => `- ${entry.name}（${entry.role}）：${entry.source}`)
    .join("\n");
}

function referencePrompt(args) {
  const references = referenceImages(args);
  if (references.length === 0) return "No named reference images were supplied.";
  return references
    .map((entry) => `${entry.name} [role: ${entry.role}] -> ${entry.source}`)
    .join("\n");
}

function normalizeOptions(options, questionId) {
  if (options === undefined) return undefined;
  if (!Array.isArray(options)) throw new Error(`clarifying question ${questionId} options must be an array`);
  const labels = new Set();
  return options.map((option, index) => {
    const label = text(option?.label, "");
    if (!label) throw new Error(`clarifying question ${questionId} option ${index + 1} needs a label`);
    if (labels.has(label)) throw new Error(`clarifying question ${questionId} has duplicate option ${label}`);
    labels.add(label);
    const description = text(option?.description, "");
    return {
      label,
      ...(description ? { description } : {}),
    };
  });
}

export function normalizeClarifyingQuestions(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("clarifying_questions must be an array");
  if (value.length > MAX_CLARIFYING_QUESTIONS) {
    throw new Error(`clarifying_questions cannot contain more than ${MAX_CLARIFYING_QUESTIONS} questions`);
  }
  const ids = new Set();
  return value.map((question, index) => {
    const id = text(question?.id, "");
    const prompt = text(question?.question, "");
    if (!id) throw new Error(`clarifying question ${index + 1} needs an id`);
    if (id === BRIEF_REVIEW_ID) throw new Error(`clarifying question id ${BRIEF_REVIEW_ID} is reserved`);
    if (ids.has(id)) throw new Error(`clarifying question id ${id} is duplicated`);
    if (!prompt) throw new Error(`clarifying question ${id} needs a question`);
    ids.add(id);
    const header = text(question?.header, "");
    const options = normalizeOptions(question?.options, id);
    return {
      id,
      question: prompt,
      ...(header ? { header } : {}),
      ...(options !== undefined ? { options } : {}),
      ...(question?.multi_select !== undefined
        ? { multi_select: question.multi_select === true }
        : {}),
    };
  });
}

export function normalizeHumanAnswers(questions, response) {
  const answerItems = Array.isArray(response?.answers) ? response.answers : [];
  const wanted = new Set(questions.map((question) => question.id));
  const answers = new Map();
  for (const answer of answerItems) {
    const id = text(answer?.id, "");
    if (!wanted.has(id)) continue;
    if (answers.has(id)) throw new Error(`userQuestions returned duplicate answer ${id}`);
    const selected = Array.isArray(answer?.selected)
      ? answer.selected.map((value) => text(value, "")).filter(Boolean)
      : [];
    const custom = typeof answer?.custom === "string" ? answer.custom : undefined;
    answers.set(id, {
      id,
      selected,
      ...(custom !== undefined ? { custom } : {}),
    });
  }
  return questions.map((question) => answers.get(question.id) || {
    id: question.id,
    selected: [],
  });
}

function answerText(question, answer) {
  const parts = [];
  if (answer?.selected?.length) parts.push(answer.selected.join("、"));
  if (typeof answer?.custom === "string" && answer.custom.trim()) parts.push(answer.custom.trim());
  return `${question.question}：${parts.join("；") || "未提供具体偏好"}`;
}

export function humanPreferenceLines(questions, answers) {
  if (questions.length === 0) return ["本轮没有额外澄清问题；以结构化 Brief 为准。"];
  const byId = new Map(answers.map((answer) => [answer.id, answer]));
  return questions.map((question) => answerText(question, byId.get(question.id)));
}

export function resolveInteractiveOptions(args) {
  return {
    duration: args.duration,
    resolution: text(args.resolution, "1280x720"),
    style: text(args.brief?.visual_style, "cinematic"),
    aspect_ratio: text(args.aspect_ratio, "16:9"),
    backend: text(args.backend, "wan"),
    force_i2v: args.force_i2v ?? false,
    enable_audit: args.enable_audit ?? true,
    validate_segments: args.validate_segments ?? false,
    seed: Number.isFinite(args.seed) ? args.seed : 0,
  };
}

export function renderCreativeBrief(args, questions, answers) {
  const brief = args.brief || {};
  const audio = brief.audio || {};
  const options = resolveInteractiveOptions(args);
  const preferences = humanPreferenceLines(questions, answers);
  const route = options.force_i2v
    ? "Hard first-frame I2V"
    : "R2V-preferred（无可用参考媒体时允许 ReCA 回退）";

  return `# ReCA Creative Brief

## 故事目标与观众
- 故事目标：${text(brief.story_goal)}
- 目标观众：${text(brief.audience)}
- 视觉风格：${text(brief.visual_style, "cinematic")}

## 人物、参考图与连续性锁
- 人物与连续性：${text(brief.character_lock)}
- 首帧：${text(args.first_frame, "无")}
- 参考图：
${referenceMarkdown(args)}

## 场景空间与常识约束
${text(brief.scene_logic)}

## 镜头节奏与切换
${text(brief.camera_rhythm)}

## 声音设计
- 台词、语言与声音身份：${text(audio.dialogue)}
- BGM：${text(audio.bgm)}
- 环境声与关键 SFX：${text(audio.sfx)}

## 必须出现
${bulletList(brief.must_have)}

## 禁止出现
${bulletList(brief.must_avoid)}

## 生成配置
- 时长：${Number.isFinite(options.duration) ? `${options.duration} 秒` : "由 ReCA 规划"}
- 分辨率：${options.resolution}
- 画幅：${options.aspect_ratio}
- 视频路由：${route}
- Backend：${options.backend}
- 审核：${options.enable_audit ? "开启" : "关闭"}
- 分段验证：${options.validate_segments ? "开启" : "关闭"}

## 本轮人类确认的偏好
${preferences.map((line) => `- ${line}`).join("\n")}`;
}

export function compileConfirmedStory(args, questions, answers) {
  const brief = args.brief || {};
  const audio = brief.audio || {};
  const preferences = humanPreferenceLines(questions, answers);

  return `[ORIGINAL STORY]
${text(args.story, "")}

[CONFIRMED CREATIVE BRIEF]
Story goal: ${text(brief.story_goal)}
Target audience: ${text(brief.audience)}
Visual style: ${text(brief.visual_style, "cinematic")}

[HUMAN CONFIRMED PREFERENCES]
${preferences.map((line) => `- ${line}`).join("\n")}

[AUDIO INTENT]
Dialogue, language, and voice identity: ${text(audio.dialogue)}
BGM: ${text(audio.bgm)}
Ambience and key SFX: ${text(audio.sfx)}

[CONTINUITY AND CAMERA CONSTRAINTS]
Character and continuity lock: ${text(brief.character_lock)}
Scene and spatial logic: ${text(brief.scene_logic)}
Camera rhythm and transition constraints: ${text(brief.camera_rhythm)}
First frame: ${text(args.first_frame, "None supplied")}
Named references:
${referencePrompt(args)}

[MUST HAVE / MUST AVOID]
Must have:
${bulletList(brief.must_have, "None specified")}
Must avoid:
${bulletList(brief.must_avoid, "None specified")}`;
}

export function createReviewQuestion(detail) {
  return {
    id: BRIEF_REVIEW_ID,
    header: "ReCA Creative Brief",
    question: "批准这份创意简报并开始生成？",
    detail,
    options: [
      { label: BRIEF_APPROVE_LABEL },
      { label: BRIEF_REVISE_LABEL },
    ],
    intent: {
      kind: "plan-review",
      approve: BRIEF_APPROVE_LABEL,
    },
  };
}

export function readReviewDecision(response) {
  const items = Array.isArray(response?.answers)
    ? response.answers.filter((answer) => answer?.id === BRIEF_REVIEW_ID)
    : [];
  const answer = items.length === 1 ? items[0] : undefined;
  const selected = Array.isArray(answer?.selected) ? answer.selected : [];
  const approved = selected.length === 1
    && selected[0] === BRIEF_APPROVE_LABEL
    && answer?.custom === undefined;
  const feedback = typeof answer?.custom === "string" && answer.custom.trim()
    ? answer.custom.trim()
    : selected.filter((label) => label !== BRIEF_APPROVE_LABEL).join("、");
  return { approved, feedback };
}
