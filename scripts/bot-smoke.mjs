#!/usr/bin/env node
// Bot API 真链路冒烟：按 PRD-0029「对接方」五步跑一遍 profile → events SSE →
// 发消息（Idempotency-Key）→ 流式 EditMessage → 输入状态，并回查历史确认落地。
//
// 用法（零依赖，Node ≥ 18）：
//   BOT_SMOKE_TOKEN=violet_bot_xxx node scripts/bot-smoke.mjs
// 可选：BOT_SMOKE_BASE_URL（默认 http://localhost:9090）、BOT_SMOKE_CONVERSATION_ID、
//      BOT_SMOKE_WAIT_MS（等人类消息的上限，默认 120000）。
const BASE = (process.env.BOT_SMOKE_BASE_URL ?? "http://localhost:9090").replace(/\/$/, "");
const TOKEN = process.env.BOT_SMOKE_TOKEN ?? "";
const WAIT_MS = Number(process.env.BOT_SMOKE_WAIT_MS ?? 120000);
const API = `${BASE}/api/v1/chat/bot`;

if (!TOKEN.startsWith("violet_bot_")) {
	console.error("缺 BOT_SMOKE_TOKEN（violet_bot_ 开头的 bot 凭据）");
	process.exit(2);
}

const checks = [];
const events = [];
const check = (name, pass, detail = "") => {
	checks.push({ name, pass, detail });
	console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const req = async (method, path, { body, headers } = {}) => {
	const res = await fetch(`${API}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${TOKEN}`,
			...(body ? { "Content-Type": "application/json" } : {}),
			...headers,
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	let json = null;
	try {
		json = JSON.parse(text);
	} catch {
		/* 非 JSON 响应（204 等）按 null 处理 */
	}
	return { status: res.status, json, text };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dataOf = (e) => {
	if (!e.data) return null;
	try {
		return JSON.parse(e.data);
	} catch {
		return null;
	}
};

// 事件流不补发：帧的 event 名即类型，data 自带消息全文
const openStream = async () => {
	const res = await fetch(`${API}/events`, {
		headers: { Authorization: `Bearer ${TOKEN}`, Accept: "text/event-stream" },
	});
	if (!res.ok || !res.body) throw new Error(`events 连接失败：HTTP ${res.status}`);
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buf = "";
	(async () => {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) return;
			buf += decoder.decode(value, { stream: true });
			let i;
			while ((i = buf.indexOf("\n\n")) >= 0) {
				const frame = buf.slice(0, i);
				buf = buf.slice(i + 2);
				const type = frame.match(/^event:\s*(.+)$/m)?.[1]?.trim();
				const data = frame.match(/^data:\s*(.+)$/m)?.[1]?.trim();
				if (type) events.push({ type, data, at: Date.now() });
			}
		}
	})();
	return () => reader.cancel().catch(() => {});
};

const waitFor = async (pred, ms, what) => {
	const until = Date.now() + ms;
	while (Date.now() < until) {
		const hit = events.find(pred);
		if (hit) return hit;
		await sleep(150);
	}
	throw new Error(`超时等待${what}`);
};

const main = async () => {
	// 1. 自查身份
	const me = await req("GET", "/profile");
	if (me.status !== 200) throw new Error(`profile 返回 ${me.status}：${me.text.slice(0, 120)}`);
	const bot = me.json.data;
	check("1 profile 拿到身份", Boolean(bot.user_id && bot.username), `${bot.username} / ${bot.user_id}`);

	// 2. 找到会话：外部得先有人在站内跟这个 bot 说过话
	let conversationId = process.env.BOT_SMOKE_CONVERSATION_ID;
	if (!conversationId) {
		const until = Date.now() + WAIT_MS;
		for (;;) {
			const list = await req("GET", "/conversations");
			conversationId = list.json?.data?.[0]?.id;
			if (conversationId || Date.now() > until) break;
			await sleep(1500);
		}
	}
	if (!conversationId) throw new Error("bot 还没有任何会话：先在站内给它发一条私信");
	check("2 定位到会话", true, conversationId);

	// 3. 订阅事件流，等人类那条消息进来
	const closeStream = await openStream();
	const inbound = await waitFor(
		(e) => e.type === "message.created" && dataOf(e)?.data?.message?.sender?.id !== bot.user_id,
		WAIT_MS,
		"人类消息（message.created）",
	);
	const inboundMsg = dataOf(inbound).data.message;
	check("3 收到入站消息", true, `"${inboundMsg.content}" 来自 ${inboundMsg.sender.display_name}`);

	// 4. 发占位消息（Idempotency-Key 必填），再用同一个键重发一次
	const key = `smoke-${crypto.randomUUID()}`;
	const body = { content: "收到，我想想…" };
	const first = await req("POST", `/conversations/${conversationId}/messages`, {
		body,
		headers: { "Idempotency-Key": key },
	});
	const second = await req("POST", `/conversations/${conversationId}/messages`, {
		body,
		headers: { "Idempotency-Key": key },
	});
	const messageId = first.json?.data?.id;
	check("4 发消息成功", first.status === 201 && Boolean(messageId), messageId ?? first.text.slice(0, 120));
	check(
		"4b 同 Idempotency-Key 重发不产生第二条",
		second.json?.data?.id === messageId,
		`${second.status} / ${second.json?.data?.id === messageId ? "同一 id" : "id 不一致"}`,
	);

	// 5. 流式编辑：同一消息反复 PATCH 追加内容
	const finalText = `关于「${inboundMsg.content}」：这条回复是分段编辑出来的。`;
	const chunks = ["关于", "关于「", finalText];
	for (const content of chunks) {
		const r = await req("PATCH", `/conversations/${conversationId}/messages/${messageId}`, {
			body: { content },
		});
		if (r.status !== 200) throw new Error(`编辑失败 ${r.status}：${r.text.slice(0, 120)}`);
		await sleep(150);
	}
	check("5 流式编辑三段全 200", true, finalText);

	// 6. 输入状态
	const typing = await req("POST", `/conversations/${conversationId}/typing`, {
		body: { is_typing: true },
	});
	const typed = await req("POST", `/conversations/${conversationId}/typing`, {
		body: { is_typing: false },
	});
	check("6 typing true/false", typing.status === 204 && typed.status === 204, `${typing.status}/${typed.status}`);

	// 7. 回环切断：bot 自己发的消息不该投给任何 bot
	await sleep(800);
	const echoed = events.filter(
		(e) => e.type === "message.created" && dataOf(e)?.data?.message?.sender?.id === bot.user_id,
	);
	check("7 bot 自己的消息不回投", echoed.length === 0, `自投事件 ${echoed.length} 条`);

	// 8. 断线恢复通道：拉历史应看到最终内容
	const hist = await req("GET", `/conversations/${conversationId}/messages?limit=10`);
	const mine = (hist.json?.data ?? []).filter((m) => m.sender?.id === bot.user_id);
	const last = mine.at(-1);
	check("8 历史里是最终内容", last?.content === finalText, last?.content?.slice(0, 40) ?? "无 bot 消息");

	closeStream();
	const failed = checks.filter((c) => !c.pass);
	console.log(
		`\n${failed.length === 0 ? "全部通过" : `${failed.length} 项失败`}：${checks.length} 项检查，事件流共 ${events.length} 帧`,
	);
	process.exitCode = failed.length === 0 ? 0 : 1;
};

await main().catch((e) => {
	console.error(`冒烟中断：${e.message}`);
	process.exitCode = 1;
});
