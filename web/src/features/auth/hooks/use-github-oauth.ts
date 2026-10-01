import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useOAuthVisibility } from "./use-oauth-visibility";

/** popup 授权码回传协议（回调页 → 发起窗口，同源 postMessage） */
export const GITHUB_OAUTH_MESSAGE = "violet:github-oauth-code";

/** GitHub 绑定意图标记：popup 被拦截降级整页时，回调页据此区分「绑定」与「登录」 */
export const GITHUB_BIND_INTENT_KEY = "violet:github-bind-intent";

// GitHub 授权页在 620 宽即可完整展示，过窄会触发其内部横向滚动
const POPUP_WIDTH = 620;
const POPUP_HEIGHT = 720;
const POPUP_WATCH_INTERVAL = 500;

interface GithubOAuthOptions {
	/** 拿到一次性授权码后走 XHR；登录或绑定由调用方决定 */
	onCode: (code: string) => void;
	/** 设置页绑定入口传 true：降级整页跳转前写 sessionStorage 意图标记 */
	bindIntent?: boolean;
}

/**
 * 以 popup 窗口发起 GitHub 授权，主页面不跳转。
 *
 * GitHub OAuth 只支持重定向授权（无 Google GIS 式站内选择器），跳转由
 * popup 承载：授权码经同源 postMessage 回传后交 onCode 走 XHR。popup 被
 * 拦截时降级整页跳转（回调页原有流程兜底）。
 *
 * @param options.onCode 授权码回调，收到即发起登录/绑定请求
 * @param options.bindIntent 降级整页时是否写绑定意图标记
 * @returns 发起函数，须在用户手势同步调用栈内调用（否则 popup 被拦截）
 */
export function useGithubOAuth({ onCode, bindIntent = false }: GithubOAuthOptions) {
	const { githubClientId } = useOAuthVisibility();
	// onCode 闭包每次渲染变化，ref 转发使发起函数引用稳定
	const onCodeRef = useRef(onCode);
	onCodeRef.current = onCode;
	const teardownRef = useRef<() => void>(() => {});

	useEffect(() => () => teardownRef.current(), []);

	return useCallback(() => {
		const clientId = githubClientId || import.meta.env.VITE_GITHUB_CLIENT_ID;
		if (!clientId) {
			toast.error("GitHub 登录未配置");
			return;
		}
		const redirectUri = encodeURIComponent(`${window.location.origin}/auth/github/callback`);
		const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`;

		teardownRef.current();
		const left = Math.max(0, (window.screen.width - POPUP_WIDTH) / 2);
		const top = Math.max(0, (window.screen.height - POPUP_HEIGHT) / 2);
		const popup = window.open(
			url,
			"github-oauth",
			`popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`,
		);
		if (!popup) {
			if (bindIntent) window.sessionStorage.setItem(GITHUB_BIND_INTENT_KEY, "1");
			window.location.href = url;
			return;
		}

		const teardown = () => {
			window.removeEventListener("message", onMessage);
			clearInterval(watchClosed);
		};
		const onMessage = (ev: MessageEvent) => {
			if (ev.origin !== window.location.origin) return;
			if (ev.data?.type !== GITHUB_OAUTH_MESSAGE) return;
			const code = typeof ev.data.code === "string" ? ev.data.code : "";
			if (!code) return;
			teardown();
			onCodeRef.current(code);
		};
		// 用户直接关掉 popup（未完成授权）时回收监听
		const watchClosed = setInterval(() => {
			if (popup.closed) teardown();
		}, POPUP_WATCH_INTERVAL);
		window.addEventListener("message", onMessage);
		teardownRef.current = teardown;
	}, [githubClientId, bindIntent]);
}
