import { Button, Toaster } from "@violet/ui";
import { useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const NEW_SAMPLES = [
	{ kind: "success", title: "已发布「独库公路，六天」" },
	{ kind: "success", title: "已复制链接" },
	{ kind: "info", title: "已切换到深色" },
	{ kind: "success", title: "已保存草稿", description: "刚刚 · 独库公路，六天" },
] as const;

/** 陈列态里的通知不自己消失，展柜才有东西可看。 */
const STAY = Number.POSITIVE_INFINITY;

/** 把 ms 后兑现的承诺交给 toast.promise，展示「加载 → 完成」。 */
const upload = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function seedStack(toasterId: string) {
	toast.success("已删除 2 条评论", {
		toasterId,
		duration: STAY,
		description: "林间与雾里的回复也一起删除",
		action: { label: "撤销", onClick: () => {} },
	});
	toast.error("评论加载失败", {
		toasterId,
		duration: STAY,
		description: "文章正文不受影响",
		action: { label: "重试", onClick: () => {} },
	});
	toast.success("已发布「独库公路，六天」", { toasterId, duration: STAY });
}

function seedSingle(toasterId: string) {
	toast.error("发布失败", {
		toasterId,
		duration: STAY,
		description: "网络中断，草稿已保存在本地",
		action: { label: "重试", onClick: () => {} },
	});
}

function seedPromise(toasterId: string) {
	toast.promise(upload(2400), {
		toasterId,
		loading: "正在上传 3 张图片…",
		success: { message: "已上传 3 张图片", duration: STAY },
	});
}

const SEEDS: Record<string, (toasterId: string) => void> = {
	stack: seedStack,
	expanded: seedStack,
	single: seedSingle,
	promise: seedPromise,
};

/** 同 id 更新是调用方的能力：同一张卡原地换文案并重新计时，这里用次数让更新看得见。 */
function repeatedTitle(count: number): string {
	return count > 1 ? `已复制链接（第 ${count} 次）` : "已复制链接";
}

/** 只关掉本展品通知区里的通知，不碰站点根通知区。 */
function dismissOwn(toasterId: string) {
	for (const item of toast.getToasts()) {
		if ("toasterId" in item && item.toasterId === toasterId) toast.dismiss(item.id);
	}
}

/** 只属于本展品的通知区加一排演示按钮，通知只出现在舞台右下角。 */
function SonnerStage({ state }: ExhibitRenderProps) {
	const toasterId = `sonner-exhibit-${useId()}`;
	const sample = useRef(0);
	const repeated = useRef(0);

	useEffect(() => {
		SEEDS[state]?.(toasterId);
		return () => dismissOwn(toasterId);
	}, [state, toasterId]);

	const sendNew = () => {
		const { kind, ...rest } = NEW_SAMPLES[sample.current++ % NEW_SAMPLES.length];
		const { title, ...options } = rest;
		toast[kind](title, { ...options, toasterId });
	};

	const sendThree = () => {
		toast.success("已发布「独库公路，六天」", { toasterId });
		toast.info("已切换到深色", { toasterId });
		toast.success("已复制链接", { toasterId });
	};

	const sendRepeated = () => {
		const id = `${toasterId}-repeat`;
		const alive = toast.getToasts().some((item) => item.id === id);
		repeated.current = alive ? repeated.current + 1 : 1;
		toast.success(repeatedTitle(repeated.current), { id, toasterId });
	};

	const sendUndo = () =>
		toast.success("已删除 2 条评论", {
			toasterId,
			description: "林间与雾里的回复也一起删除",
			action: {
				label: "撤销",
				onClick: () => toast.info("已撤销删除", { toasterId }),
			},
		});

	const sendError = () =>
		toast.error("发布失败", {
			toasterId,
			description: "网络中断，草稿已保存在本地",
			action: { label: "重试", onClick: () => {} },
		});

	const sendWarning = () => toast.warning("还有 3 张图片没有替代文字", { toasterId });

	const sendUpload = () =>
		toast.promise(upload(2400), {
			toasterId,
			loading: "正在上传 3 张图片…",
			success: "已上传 3 张图片",
		});

	const clear = () => dismissOwn(toasterId);

	return (
		<div className="absolute inset-0 overflow-hidden rounded-xl bg-muted/50">
			<div className="flex flex-wrap gap-2 p-4">
				<Button size="sm" variant="outline" onClick={sendNew}>
					发一条新的
				</Button>
				<Button size="sm" variant="outline" onClick={sendThree}>
					连发三条
				</Button>
				<Button size="sm" variant="outline" onClick={sendRepeated}>
					更新同一条
				</Button>
				<Button size="sm" variant="outline" onClick={sendUndo}>
					带撤销
				</Button>
				<Button size="sm" variant="outline" onClick={sendError}>
					出错
				</Button>
				<Button size="sm" variant="outline" onClick={sendWarning}>
					警告
				</Button>
				<Button size="sm" variant="outline" onClick={sendUpload}>
					上传：加载 → 完成
				</Button>
				<Button size="sm" variant="ghost" onClick={clear}>
					全部清除
				</Button>
			</div>
			<Toaster
				id={toasterId}
				expand={state === "expanded"}
				style={{ position: "absolute" }}
				offset={24}
				mobileOffset={24}
				customAriaLabel="展品通知（⌥T）"
			/>
		</div>
	);
}

export const sonnerExhibit: Exhibit = {
	id: "sonner",
	name: "轻提示",
	units: ["sonner"],
	zone: "stage",
	category: "feedback",
	footprint: { width: 480, height: 356 },
	states: [
		{ id: "stack", label: "叠放" },
		{ id: "expanded", label: "展开" },
		{ id: "single", label: "单条" },
		{ id: "promise", label: "加载到结果" },
	],
	Render: SonnerStage,
};
