import { LabIndex } from "@features/lab/ui/LabIndex";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /lab - 原型实验室索引
 *
 * 所有页面级原型实验室（/lab/<name>）的统一入口。新增实验室的
 * 三步流程见 features/lab/model/registry.ts。
 */
export const Route = createFileRoute("/lab/")({
	component: LabIndex,
});
