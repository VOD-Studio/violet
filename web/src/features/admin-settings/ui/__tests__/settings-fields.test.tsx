import {
	HOME_FOOTPRINT_AGGREGATION_DEFAULT_DAYS,
	HOME_FOOTPRINT_AGGREGATION_MAX_DAYS,
	HOME_FOOTPRINT_AGGREGATION_MIN_DAYS,
} from "@features/settings/model/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NumberInput } from "@violet/ui";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { Field, SwitchField } from "../settings-fields";

interface NumericSettings {
	custom_emoji_max_per_user: number;
	home_footprint_aggregation_days: number;
}

function NumericSettingsForm({ onSubmit }: { onSubmit: (values: NumericSettings) => void }) {
	const { register, handleSubmit } = useForm<NumericSettings>({
		defaultValues: {
			custom_emoji_max_per_user: 10,
			home_footprint_aggregation_days: HOME_FOOTPRINT_AGGREGATION_DEFAULT_DAYS,
		},
	});
	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Field label="自定义表情上限">
				<NumberInput
					min={0}
					{...register("custom_emoji_max_per_user", {
						valueAsNumber: true,
						min: { value: 0, message: "不能为负数" },
					})}
				/>
			</Field>
			<Field label="节点聚合天数">
				<NumberInput
					min={HOME_FOOTPRINT_AGGREGATION_MIN_DAYS}
					max={HOME_FOOTPRINT_AGGREGATION_MAX_DAYS}
					{...register("home_footprint_aggregation_days", {
						valueAsNumber: true,
						min: HOME_FOOTPRINT_AGGREGATION_MIN_DAYS,
						max: HOME_FOOTPRINT_AGGREGATION_MAX_DAYS,
					})}
				/>
			</Field>
			<button type="submit">保存设置</button>
		</form>
	);
}

describe("设置页表单项", () => {
	it("标签与控件关联，提示可由辅助技术读取", () => {
		render(
			<Field label="自定义表情上限" hint="0 表示使用部署默认值">
				<NumberInput />
			</Field>,
		);
		const input = screen.getByLabelText("自定义表情上限", { exact: true });
		const hint = screen.getByText("0 表示使用部署默认值");
		expect(input.getAttribute("aria-describedby")).toBe(hint.closest("[aria-live]")?.id);
	});

	it("越界草稿失焦规范化后，RHF 提交归零和上限的数字模型", async () => {
		const submit = vi.fn();
		render(<NumericSettingsForm onSubmit={submit} />);
		const emojiLimit = screen.getByRole("spinbutton", { name: "自定义表情上限" });
		const days = screen.getByRole("spinbutton", { name: "节点聚合天数" });

		fireEvent.change(emojiLimit, { target: { value: "-5" } });
		expect(emojiLimit).toHaveProperty("value", "-5");
		fireEvent.blur(emojiLimit);
		expect(emojiLimit).toHaveProperty("value", "0");
		fireEvent.change(days, {
			target: { value: String(HOME_FOOTPRINT_AGGREGATION_MAX_DAYS + 1) },
		});
		fireEvent.blur(days);
		expect(days).toHaveProperty("value", String(HOME_FOOTPRINT_AGGREGATION_MAX_DAYS));
		fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
		expect(submit.mock.calls[0][0]).toEqual({
			custom_emoji_max_per_user: 0,
			home_footprint_aggregation_days: HOME_FOOTPRINT_AGGREGATION_MAX_DAYS,
		});
	});

	it("可选数字字段清空后提交 NaN，不把空串转换为部署默认值 0", async () => {
		const submit = vi.fn();
		render(<NumericSettingsForm onSubmit={submit} />);
		const emojiLimit = screen.getByRole("spinbutton", { name: "自定义表情上限" });

		fireEvent.change(emojiLimit, { target: { value: "" } });
		fireEvent.blur(emojiLimit);
		expect(emojiLimit).toHaveProperty("value", "");
		fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
		expect(submit.mock.calls[0][0].custom_emoji_max_per_user).toBeNaN();
	});

	it("开关行的标签点击即切换", () => {
		const change = vi.fn();
		render(<SwitchField label="启用评论" checked={false} onCheckedChange={change} />);
		expect(screen.getByRole("switch", { name: "启用评论" })).toBeDefined();
		fireEvent.click(screen.getByText("启用评论"));
		expect(change).toHaveBeenCalledWith(true);
	});
});
