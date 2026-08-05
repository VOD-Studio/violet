import { useLlmSettings, useUpdateLlm } from "@features/admin-settings/api/queries";
import type { LlmSettingsDTO } from "@features/admin-settings/model/types";
import { SettingsSubPage } from "@features/admin-settings/ui/SettingsSubPage";
import { Field } from "@features/admin-settings/ui/settings-fields";
import { useSettingsForm } from "@features/admin-settings/ui/use-settings-form";
import { Input } from "@shared/ui/base/input";
import { createFileRoute } from "@tanstack/react-router";

/** LLM 配置子页表单值（仅本页字段） */
interface LlmForm {
	llm_api_key: string;
	llm_api_url: string;
	llm_model: string;
	llm_protocol: string;
}

function LlmSettingsPage() {
	const { register, isLoading, isPending, onSubmit } = useSettingsForm<LlmForm, LlmSettingsDTO>(
		useLlmSettings(),
		useUpdateLlm(),
		(data) => ({
			llm_api_key: data.llm_api_key ?? "",
			llm_api_url: data.llm_api_url ?? "",
			llm_model: data.llm_model ?? "",
			llm_protocol: data.llm_protocol ?? "openai",
		}),
	);

	return (
		<SettingsSubPage
			title="LLM 配置"
			description="OpenAI 协议兼容端点"
			isLoading={isLoading}
			isPending={isPending}
			onSubmit={onSubmit}
		>
			<section className="space-y-4">
				<h3 className="text-sm font-semibold">LLM 配置</h3>
				<p className="text-xs text-muted-foreground">
					配置 OpenAI 协议兼容端点（OpenAI / DeepSeek / Moonshot / 通义 / 智谱 / Ollama /
					vLLM），用于「导入链接」时的 AI 公式还原等功能。留空则禁用 AI 能力。
				</p>
				<Field label="API Key">
					<Input type="password" {...register("llm_api_key")} placeholder="sk-..." />
				</Field>
				<Field label="API Base URL">
					<Input {...register("llm_api_url")} placeholder="https://api.openai.com/v1" />
				</Field>
				<Field label="模型名">
					<Input {...register("llm_model")} placeholder="gpt-4o-mini" />
				</Field>
				<Field label="协议">
					<Input {...register("llm_protocol")} placeholder="openai" />
				</Field>
			</section>
		</SettingsSubPage>
	);
}

export const Route = createFileRoute("/admin/settings/llm")({
	component: LlmSettingsPage,
});
