#!/usr/bin/env bun
/**
 * 堇喵 → Codex 桌宠 spritesheet 导出器(issue #248)。
 *
 * 流程:headless Chrome 打开 dev server 页面,页面内 import 包引擎模块
 * (Vite 实时转译 @violet/mascot 源),逐动作行手动驱动 tick 时间轴采样帧,
 * 页面内 canvas 合成 atlas(1536x1872,8 列 9 行,cell 192x208),回传 webp 落盘。
 *
 * 前置:dev server 运行中(make docker-dev,5173 端口)。
 * 产物:web/scripts/codex-pet/dist/spritesheet.webp
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEBUG_PORT = Number(process.env.PET_DEBUG_PORT ?? 9350);
const BASE = `http://127.0.0.1:${DEBUG_PORT}`;
const APP_URL = process.env.PET_APP_URL ?? "http://localhost:5173/";
const OUT_DIR = resolve(dirname(new URL(import.meta.url).pathname), "dist");
const SPRITESHEET = resolve(OUT_DIR, "spritesheet.webp");
// 引擎自包化后经 Vite 源路径导入(feat/lab-mascot 已无本地 engine)
const ENGINE_URL = `${APP_URL}packages/mascot/src/engine/mascot.ts`;

// 页面内执行:加载引擎 → 逐行采样 → 合成 atlas → 返回 webp base64
const PAGE_SCRIPT = `
const CELL_W = 192, CELL_H = 208, COLS = 8, ROWS_COUNT = 9;
const { Mascot } = await import('${ENGINE_URL}');

// 行规格:awesome-codex-pet animation-rows 契约
// emotion: 表情 ID;window: 采样窗(表情一轮时间);cols: 采样帧数
// dx/dy: 帧序列的 cell 内偏移(位移动画);trigger: 采样前触发的一次动作
const ROWS = [
  { name: 'idle',           emotion: '00', window: 1600, cols: 6 },
  { name: 'running-right',  emotion: '00', window: 1200, cols: 8, dx: 'right' },
  { name: 'running-left',   emotion: '00', window: 1200, cols: 8, dx: 'left' },
  { name: 'waving',         emotion: '08', window: 2600, cols: 4 },
  { name: 'jumping',        emotion: '00', window: 900,  cols: 5, trigger: 'bounce' },
  { name: 'failed',         emotion: '27', window: 2400, cols: 8 },
  { name: 'waiting',        emotion: '03', window: 1800, cols: 6 },
  { name: 'running',        emotion: '00', window: 1000, cols: 6, dy: 'hop' },
  { name: 'review',         emotion: '25', window: 2400, cols: 6 },
];

// 宿主容器:192x192(等比 260→192),透明背景,离屏
document.body.innerHTML = '';
const host = document.createElement('div');
host.style.cssText = 'position:fixed;left:-9999px;top:0;width:192px;height:192px;background:transparent';
document.body.appendChild(host);

const atlas = document.createElement('canvas');
atlas.width = COLS * CELL_W; atlas.height = ROWS_COUNT * CELL_H;
const ctx = atlas.getContext('2d');

const svgToImage = (svg) => new Promise((res, rej) => {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '192'); clone.setAttribute('height', '192');
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = rej;
  img.src = url;
});

for (let rowIdx = 0; rowIdx < ROWS.length; rowIdx++) {
  const row = ROWS[rowIdx];
  const m = new Mascot(host, { emotion: row.emotion });
  m.stop();
  m.setEmotion(row.emotion); // 重锚时间轴原点
  let simT = performance.now();
  if (row.trigger === 'bounce') { m.bounce(); }
  m.tick(simT, 1/60); // 预热一帧,确保表情序列初始化
  for (let col = 0; col < row.cols; col++) {
    const step = row.window / row.cols;
    simT += step;
    m.tick(simT, step / 1000);
    const img = await svgToImage(m.svg);
    let ox = (CELL_W - 192) / 2, oy = (CELL_H - 192) / 2;
    if (row.dx === 'right') ox += -20 + (col / row.cols) * 40;
    if (row.dx === 'left')  ox +=  20 - (col / row.cols) * 40;
    if (row.dy === 'hop')   oy -= Math.abs(Math.sin((col / row.cols) * Math.PI * 2)) * 10;
    ctx.drawImage(img, col * CELL_W + ox, rowIdx * CELL_H + oy, 192, 192);
  }
  m.destroy();
}

const blob = await new Promise((res) => atlas.toBlob(res, 'image/webp', 0.92));
const buf = await blob.arrayBuffer();
let bin = ''; const bytes = new Uint8Array(buf);
for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
return btoa(bin);
`;

// 清理上次中断残留的调试端口占用(僵尸 headless Chrome 会让 CDP 永不就绪)
try {
	execFileSync("pkill", ["-f", `remote-debugging-port=${DEBUG_PORT}`], { stdio: "ignore" });
	await Bun.sleep(500);
} catch { }
const proc = Bun.spawn(
	[
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"--headless=new",
		`--remote-debugging-port=${DEBUG_PORT}`,
		"--no-first-run",
		"--user-data-dir=/tmp/mascot-pet-export-profile",
		"--force-device-scale-factor=1",
		"about:blank",
	],
	{ stdout: "ignore", stderr: "ignore" },
);

const { promise: portReady, resolve: portOk } = Promise.withResolvers();
(async () => {
	for (let i = 0; i < 50; i++) {
		try {
			if ((await fetch(`${BASE}/json/version`)).ok) return portOk();
		} catch { }
		await Bun.sleep(300);
	}
	portOk();
})();
await portReady;

const tab = await (await fetch(`${BASE}/json/new?${APP_URL}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
	const msg = JSON.parse(ev.data);
	if (typeof msg.id === "number" && pending.has(msg.id)) {
		pending.get(msg.id)?.(msg);
		pending.delete(msg.id);
	}
};
const { promise: opened, resolve: wsOk } = Promise.withResolvers();
ws.onopen = () => wsOk();
await opened;
const send = (method, params = {}) => {
	const id = ++msgId;
	const { promise, resolve } = Promise.withResolvers();
	pending.set(id, resolve);
	ws.send(JSON.stringify({ id, method, params }));
	return promise;
};
const evalJs = async (expression) => {
	const r = await send("Runtime.evaluate", {
		expression,
		awaitPromise: true,
		returnByValue: true,
	});
	const exc = r?.result?.exceptionDetails;
	if (exc) {
		throw new Error(
			`页面执行异常: ${exc.exception?.description ?? exc.text ?? "unknown"}`,
		);
	}
	return r?.result?.result?.value;
};

await send("Page.enable");
await send("Runtime.enable");
// 就绪两步走:先等导航离开 about:blank(null origin 上 fetch/import 都会被 CORS 拒),
// 再用引擎 import 本身做探针——成功即模块链可用
for (let i = 0; i < 60; i++) {
	const href = await evalJs("location.href");
	if (typeof href === "string" && href.startsWith("http")) break;
	await Bun.sleep(500);
}
for (let i = 0; i < 60; i++) {
	if (
		await evalJs(
			`import('${ENGINE_URL}').then(() => true).catch(() => false)`,
		)
	)
		break;
	await Bun.sleep(500);
}

console.log("采样 9 行动作...");
const b64 = await evalJs(`(async () => { ${PAGE_SCRIPT} })()`);
if (typeof b64 !== "string" || !b64.startsWith("UklGR")) {
	// webp base64 头;非 webp 头说明页面返回异常
	throw new Error(`atlas 导出异常: ${String(b64).slice(0, 120)}`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(SPRITESHEET, Buffer.from(b64, "base64"));
console.log(`atlas 已导出: ${SPRITESHEET} (${Math.round((b64.length * 0.75) / 1024)} KB)`);

proc.kill();
process.exit(0);
