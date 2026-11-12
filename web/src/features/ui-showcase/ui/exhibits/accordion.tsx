import { Accordion, AccordionItem } from "@violet/ui";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

function FaqAccordion() {
	return (
		<Accordion className="w-110" defaultValue={["review"]}>
			<AccordionItem value="review" title="评论需要审核吗？">
				首次评论需要审核，通过后同一账号不再审核。审核通常在一天内完成。
			</AccordionItem>
			<AccordionItem value="repost" title="可以转载这里的文章吗？">
				可以，署名并附原文链接即可；转载来的文章以原站的规则为准。
			</AccordionItem>
			<AccordionItem value="links" title="怎么交换友链？">
				在友链页底部提交申请，先把本站加到你的友链里，通常一两天内处理。
			</AccordionItem>
		</Accordion>
	);
}

function SettingsAccordion() {
	const [open, setOpen] = useState("publish");
	return (
		<Accordion type="single" className="w-110" value={open} onValueChange={setOpen}>
			<AccordionItem value="publish" title="发布设置" summary="立即发布 · 允许评论">
				发布方式、评论与置顶都在这里；改完不需要单独保存，跟着文章一起保存。
			</AccordionItem>
			<AccordionItem value="seo" title="搜索与分享" summary="已填写摘要">
				摘要会出现在搜索结果与分享卡片上，建议 60 到 120 字。
			</AccordionItem>
			<AccordionItem value="repost" title="转载信息" summary="原创">
				转载时填原文地址，文章顶部会显示来源。
			</AccordionItem>
		</Accordion>
	);
}

function AccordionStage({ state }: ExhibitRenderProps) {
	return state === "settings" ? <SettingsAccordion /> : <FaqAccordion />;
}

export const accordionExhibit: Exhibit = {
	id: "accordion",
	name: "折叠面板",
	units: ["accordion"],
	zone: "content",
	category: "display",
	footprint: { width: 448, height: 360 },
	states: [
		{ id: "faq", label: "常见问题" },
		{ id: "settings", label: "设置分组" },
	],
	Render: AccordionStage,
};
