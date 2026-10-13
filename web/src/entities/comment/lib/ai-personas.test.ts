import { describe, expect, it } from "vitest";
import { AI_PERSONAS, getCommentAuthorPresentation } from "./ai-personas";

const families = [
	["ChatGPT", "gpt"],
	["Claude", "claude"],
	["GLM", "glm"],
	["Grok", "grok"],
	["DeepSeek", "deepseek"],
	["Kimi", "kimi"],
	["Gemini", "gemini"],
] as const;

function expectPersona(name: string, id: keyof typeof AI_PERSONAS) {
	const author = { author_name: name, is_ai: true, avatar_url: "/uploads/pat-owner.webp" };
	const presentation = getCommentAuthorPresentation(author);
	expect(presentation).toMatchObject({
		personaId: id,
		avatarUrl: AI_PERSONAS[id].avatarUrl,
		displayName: id === "deepseek" ? `大肥鱼 · ${name.trim()}` : name.trim(),
	});
	expect(author.author_name).toBe(name);
}

describe("AI 模型署名兼容性", () => {
	it.each(
		families.flatMap(([name, id]) =>
			[" Bot", " Assistant", " Agent", " AI Assistant", " 助手", " 机器人"].map(
				(suffix) => [`${name}${suffix}`, id] as const,
			),
		),
	)("%s 选择对应家族形象并保留原署名", expectPersona);

	it.each([
		["GPT-4o mini", "gpt"],
		["GPT-5.1 Codex", "gpt"],
		["gpt-oss-120b", "gpt"],
		["ChatGPT4o", "gpt"],
		["o1-preview", "gpt"],
		["o3", "gpt"],
		["o4-mini", "gpt"],
		["Codex", "gpt"],
		["codex-mini-latest", "gpt"],
		["Claude Sonnet 4.6", "claude"],
		["claude-3-5-sonnet-20241022", "claude"],
		["ClaudeOpus4.6", "claude"],
		["Claude Haiku", "claude"],
		["Claude Code", "claude"],
		["GLM-4.7 Flash", "glm"],
		["GLM4.7", "glm"],
		["grok-code-fast-1", "grok"],
		["grok-build-0.1", "grok"],
		["Grok4", "grok"],
		["Grok 4 Fast Non Reasoning Bot", "grok"],
		["DeepSeekR1", "deepseek"],
		["deepseek-chat", "deepseek"],
		["deepseek-coder-v2", "deepseek"],
		["deepseek-reasoner", "deepseek"],
		["KimiK2", "kimi"],
		["kimi-k2-thinking", "kimi"],
		["Kimi Thinking", "kimi"],
		["Gemini2.5Pro", "gemini"],
		["Gemini Flash Lite", "gemini"],
		["openai/gpt-5.1-codex", "gpt"],
		["OpenAI / o4-mini Assistant", "gpt"],
		["anthropic/claude-sonnet-4", "claude"],
		["z-ai/glm-4.7", "glm"],
		["zhipuai/glm-4.7", "glm"],
		["x-ai/grok-4", "grok"],
		["xai/grok-code-fast-1", "grok"],
		["deepseek/deepseek-chat", "deepseek"],
		["moonshotai/kimi-k2", "kimi"],
		["moonshot/kimi-k2", "kimi"],
		["google/gemini-2.5-flash", "gemini"],
		["  gRoK   bOt  ", "grok"],
		["Grok_Bot", "grok"],
		["Ｇｒｏｋ　Ｂｏｔ", "grok"],
		["Claude—Sonnet—4.6", "claude"],
		["GLM_4.7_Flash", "glm"],
		["GPT - 4o Mini Assistant", "gpt"],
		["gRoK - bOt", "grok"],
	] as const)("%s 兼容版本名、供应商前缀或分隔符", expectPersona);

	it.each([
		"",
		"未知模型",
		"Violet AI",
		"Local Model",
		"My GPT Assistant",
		"My Grok Bot",
		"Grok Botanical",
		"Claude Sonnetology",
		"DeepSeek Chatroom",
		"Gemini Professional",
		"Kimi Thinkingly",
		"GPTfoo",
		"Grok/Claude",
		"openai/grok-4",
		"anthropic/gpt-4o",
		"unknown/grok-4",
		"/grok-4",
		"x-ai/other/grok-4",
	])("%s 不误归入已知家族", (name) => {
		expect(getCommentAuthorPresentation({ author_name: name, is_ai: true })).toMatchObject({
			personaId: "unknown",
			avatarUrl: AI_PERSONAS.unknown.avatarUrl,
			displayName: name && name !== "未知模型" ? `未知模型 · ${name}` : "未知模型",
		});
	});

	it.each(families)("真人署名 %s 仍按真人展示", (name) => {
		expect(
			getCommentAuthorPresentation({
				author_name: `${name} Bot`,
				is_ai: false,
				avatar_url: "/uploads/human.webp",
			}),
		).toEqual({
			displayName: `${name} Bot`,
			avatarUrl: "/uploads/human.webp",
			initials: name[0].toUpperCase(),
			personaId: undefined,
		});
	});
});
