import { createFileRoute } from "@tanstack/react-router";

// 画稿与时间轴一节；工作台由父路由 /inkline 渲染，切换各节时保持挂载
export const Route = createFileRoute("/inkline/")({});
