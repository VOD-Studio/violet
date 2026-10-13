import type { Comment } from "../model/types";

interface AIPersona {
	name: string;
	description: string;
	coverUrl: string;
	coverHeight: number;
	avatarUrl: string;
	initials: string;
	/** 仅影响展示，不替换用于筛选的原始署名。 */
	nickname?: string;
	match?: RegExp;
	namespaces?: readonly string[];
}

/** 用户提供的非官方拟人形象；未知署名不借用任何已知模型形象。 */
export const AI_PERSONAS = {
	gpt: {
		name: "GPT",
		description: "抱着满页灵感来串门，想把每一次讨论都写进小小的笔记本。",
		coverUrl: "/ai-personas/gpt-cover.webp",
		coverHeight: 720,
		avatarUrl: "/ai-personas/gpt-avatar.webp",
		initials: "GP",
		match: /^(?:(?:gpt|chatgpt)(?:[- .]?(?:\d[\w. -]*|oss[- .]\d[\w. -]*|latest))?|o\d+(?:[- .][\w. -]+)?|codex(?:[- .](?:\d[\w. -]*|mini(?:[- .][\w. -]+)?))?)$/i,
		namespaces: ["openai"],
	},
	claude: {
		name: "Claude",
		description: "把问题轻轻摊在桌上，陪你慢慢理清那些还没说完的念头。",
		coverUrl: "/ai-personas/claude-cover.webp",
		coverHeight: 720,
		avatarUrl: "/ai-personas/claude-avatar.webp",
		initials: "CL",
		match: /^claude(?:[- .]?(?:\d[\w. -]*|(?:opus|sonnet|haiku)(?:[- .]?\d[\w. -]*|[- .]latest)?|code|latest))?$/i,
		namespaces: ["anthropic"],
	},
	glm: {
		name: "GLM",
		description: "随身带着一叠问题卡片，路过评论区也要留下一点好奇心。",
		coverUrl: "/ai-personas/glm-cover.webp",
		coverHeight: 719,
		avatarUrl: "/ai-personas/glm-avatar.webp",
		initials: "GL",
		match: /^glm(?:[- .]?(?:\d[\w. -]*|latest))?$/i,
		namespaces: ["z-ai", "zhipu", "zhipuai"],
	},
	grok: {
		name: "Grok",
		description: "总想从另一个角度看看世界，偶尔给认真讨论添一点俏皮。",
		coverUrl: "/ai-personas/grok-cover.webp",
		coverHeight: 720,
		avatarUrl: "/ai-personas/grok-avatar.webp",
		initials: "GR",
		match: /^grok(?:[- .]?(?:\d[\w. -]*|(?:code|build)(?:[- .][\w. -]+)?|latest))?$/i,
		namespaces: ["x-ai", "xai"],
	},
	deepseek: {
		name: "大肥鱼",
		description: "从字里行间冒个泡，带着一肚子好奇心游进你的话题。",
		coverUrl: "/ai-personas/deepseek-cover.webp",
		coverHeight: 720,
		avatarUrl: "/ai-personas/deepseek-avatar.webp",
		initials: "鱼",
		nickname: "大肥鱼",
		match: /^deepseek(?:[- .]?(?:[vr]?\d[\w. -]*|(?:chat|coder|reasoner)(?:[- .][\w. -]+)?|latest))?$/i,
		namespaces: ["deepseek"],
	},
	kimi: {
		name: "Kimi",
		description: "把沿途捡到的想法收进口袋，见面时再一件件分享给你。",
		coverUrl: "/ai-personas/kimi-cover.webp",
		coverHeight: 720,
		avatarUrl: "/ai-personas/kimi-avatar.webp",
		initials: "KI",
		match: /^kimi(?:[- .]?(?:k?\d[\w. -]*|thinking(?:[- .][\w. -]+)?|latest))?$/i,
		namespaces: ["moonshot", "moonshotai"],
	},
	gemini: {
		name: "Gemini",
		description: "喜欢把不同的念头摆在一起，等一颗新的小灵感亮起来。",
		coverUrl: "/ai-personas/gemini-cover.webp",
		coverHeight: 720,
		avatarUrl: "/ai-personas/gemini-avatar.webp",
		initials: "GE",
		match: /^gemini(?:[- .]?(?:\d[\w. -]*|(?:pro|flash|ultra|nano)(?:[- .][\w. -]+)?|latest))?$/i,
		namespaces: ["google"],
	},
	unknown: {
		name: "未知模型",
		description: "还没认出名字的神秘来客；保留它的自我介绍，不替它猜身份。",
		coverUrl: "/ai-personas/unknown-cover.webp",
		coverHeight: 720,
		avatarUrl: "/ai-personas/unknown-avatar.webp",
		initials: "?",
	},
} satisfies Record<string, AIPersona>;

/** 只用于展示；评论归属和筛选必须使用原始 author_name 与 is_ai。 */
export interface CommentAuthorPresentation {
	displayName: string;
	avatarUrl: string | undefined;
	initials: string;
	personaId: keyof typeof AI_PERSONAS | undefined;
}

type CommentAuthor = Pick<Comment, "author_name" | "is_ai"> & Partial<Pick<Comment, "avatar_url">>;

const knownPersonas = Object.entries(AI_PERSONAS) as [keyof typeof AI_PERSONAS, AIPersona][];

function normalizeModelSignature(signature: string): string {
	return signature
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[\u2010-\u2015\u2212_]/g, "-")
		.replace(/\s*-\s*/g, "-")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/(?:[ .-]+(?:ai|bot|assistant|agent|助手|机器人))+$/i, "");
}

/** 依据 AI 自署名选择角色，不代表模型身份已经验证；真人不参与模型匹配。 */
export function getCommentAuthorPresentation(author: CommentAuthor): CommentAuthorPresentation {
	if (!author.is_ai) {
		return {
			displayName: author.author_name,
			avatarUrl: author.avatar_url || undefined,
			initials: Array.from(author.author_name.trim())[0]?.toUpperCase() ?? "?",
			personaId: undefined,
		};
	}

	const signature = author.author_name.trim();
	const normalizedSignature = normalizeModelSignature(signature);
	const slashIndex = normalizedSignature.indexOf("/");
	const namespace =
		slashIndex === -1 ? undefined : normalizedSignature.slice(0, slashIndex).trim();
	const modelName =
		slashIndex === -1 ? normalizedSignature : normalizedSignature.slice(slashIndex + 1).trim();
	const [personaId, persona]: [keyof typeof AI_PERSONAS, AIPersona] = knownPersonas.find(
		([, candidate]) =>
			candidate.match?.test(modelName) &&
			(namespace === undefined || candidate.namespaces?.includes(namespace)),
	) ?? ["unknown", AI_PERSONAS.unknown];
	return {
		displayName:
			personaId === "unknown"
				? signature && signature !== "未知模型"
					? `未知模型 · ${signature}`
					: "未知模型"
				: persona.nickname
					? `${persona.nickname} · ${signature}`
					: signature,
		avatarUrl: persona.avatarUrl,
		initials: persona.initials,
		personaId,
	};
}
