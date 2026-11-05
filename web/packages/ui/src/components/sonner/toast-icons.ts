import { createLucideIcon } from "lucide-react";

/** 勾的笔画单独带类名，加载变成功时沿笔画画出。 */
export const ToastSuccessIcon = /* @__PURE__ */ createLucideIcon("toast-success", [
	["path", { d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", key: "ring" }],
	["path", { d: "m8.5 12.5 2.5 2.5 4.5-5", className: "v-toast__tick", key: "tick" }],
]);

export const ToastErrorIcon = /* @__PURE__ */ createLucideIcon("toast-error", [
	["path", { d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v4M12 16h.01", key: "mark" }],
]);

export const ToastWarningIcon = /* @__PURE__ */ createLucideIcon("toast-warning", [
	[
		"path",
		{
			d: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
			key: "mark",
		},
	],
]);

export const ToastInfoIcon = /* @__PURE__ */ createLucideIcon("toast-info", [
	["path", { d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01", key: "mark" }],
]);
