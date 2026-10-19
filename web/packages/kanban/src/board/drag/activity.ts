import type { RefObject } from "react";

/** 当前占用看板交互的输入方式；同一时刻只有一种，为 null 表示空闲。 */
export type Activity = "pointer" | "keyboard" | null;

export type ActivityRef = RefObject<Activity>;
