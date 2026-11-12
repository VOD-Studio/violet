import { Checkbox, Label } from "@violet/ui";
import { useId, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const CHANNELS = [
	{ id: "blog", label: "博客" },
	{ id: "notes", label: "手记" },
	{ id: "tweets", label: "推文" },
	{ id: "gallery", label: "图集" },
];

const CARDS = [
	{ id: "rss", title: "RSS 订阅", description: "新文章出现在你的阅读器里" },
	{ id: "mail", title: "邮件", description: "每周一封，只有标题和摘要" },
	{ id: "push", title: "站内通知", description: "有人回复你时提醒" },
];

function CheckboxFamily({ state }: ExhibitRenderProps) {
	const id = useId();
	const [selected, setSelected] = useState(["blog"]);
	const [cards, setCards] = useState(["rss"]);
	const disabled = state === "disabled";
	const all = selected.length === CHANNELS.length;
	const toggle = (channel: string) =>
		setSelected((current) =>
			current.includes(channel)
				? current.filter((item) => item !== channel)
				: [...current, channel],
		);
	const toggleCard = (card: string) =>
		setCards((current) =>
			current.includes(card) ? current.filter((item) => item !== card) : [...current, card],
		);
	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-start gap-12">
				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-2.5">
						<Checkbox id={`${id}-device`} defaultChecked disabled={disabled} />
						<Label htmlFor={`${id}-device`}>记住这台设备</Label>
					</div>
					<div className="flex items-start gap-2.5">
						<Checkbox id={`${id}-comments`} disabled={disabled} />
						<span className="flex flex-col">
							<Label htmlFor={`${id}-comments`}>允许评论</Label>
							<span className="text-13 text-muted-foreground">
								关闭后已有评论仍然显示
							</span>
						</span>
					</div>
				</div>
				<div className="flex flex-col gap-2.5">
					<div className="flex items-center gap-2.5">
						<Checkbox
							id={`${id}-all`}
							checked={all ? true : selected.length > 0 ? "indeterminate" : false}
							onCheckedChange={() =>
								setSelected(all ? [] : CHANNELS.map((item) => item.id))
							}
							disabled={disabled}
						/>
						<Label htmlFor={`${id}-all`}>全部栏目</Label>
					</div>
					{CHANNELS.map((channel) => (
						<div key={channel.id} className="flex items-center gap-2.5 pl-6.5">
							<Checkbox
								id={`${id}-${channel.id}`}
								checked={selected.includes(channel.id)}
								onCheckedChange={() => toggle(channel.id)}
								disabled={disabled}
							/>
							<Label htmlFor={`${id}-${channel.id}`}>{channel.label}</Label>
						</div>
					))}
				</div>
			</div>
			<div className="grid max-w-134 grid-cols-3 gap-3">
				{CARDS.map((card) => (
					// biome-ignore lint/a11y/useKeyWithClickEvents: 整卡点击只是指针便利，键盘走内部 Checkbox 的 Space 激活
					<div
						key={card.id}
						className="v-checkbox-card"
						data-state={cards.includes(card.id) ? "checked" : "unchecked"}
						data-disabled={disabled ? "" : undefined}
						onClick={() => {
							if (!disabled) toggleCard(card.id);
						}}
					>
						<Checkbox
							checked={cards.includes(card.id)}
							onCheckedChange={() => toggleCard(card.id)}
							onClick={(event) => event.stopPropagation()}
							aria-label={card.title}
							disabled={disabled}
						/>
						<span className="v-checkbox-card__text">
							<span className="v-checkbox-card__title">{card.title}</span>
							<span className="v-checkbox-card__description">{card.description}</span>
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

export const checkboxExhibit: Exhibit = {
	id: "checkbox",
	name: "复选框",
	units: ["checkbox"],
	zone: "field",
	category: "form",
	footprint: { width: 560, height: 260 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "disabled", label: "禁用" },
	],
	Render: CheckboxFamily,
};
