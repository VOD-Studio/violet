/** PROTOTYPE（#645）：四季主题并排对照板，只在 prototype/theme-seasons 分支保留。 */
import { SeasonsBoard } from "@features/theme-seasons-prototype/SeasonsBoard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/prototype/seasons")({
	head: () => ({ meta: [{ title: "四季主题样稿 — Violet" }] }),
	component: SeasonsBoard,
});
