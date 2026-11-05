/**
 * GB2312 一级汉字（3755 个）按拼音字母序排列，各声母的起始区位码是固定的。
 * 用 TextDecoder 一次解出全部一级字，再按位置归入声母，不依赖 Intl 排序规则与拼音库。
 */
const INITIAL_STARTS: ReadonlyArray<readonly [letter: string, code: number]> = [
	["a", 0xb0a1],
	["b", 0xb0c5],
	["c", 0xb2c1],
	["d", 0xb4ee],
	["e", 0xb6ea],
	["f", 0xb7a2],
	["g", 0xb8c1],
	["h", 0xb9fe],
	["j", 0xbbf7],
	["k", 0xbfa6],
	["l", 0xc0ac],
	["m", 0xc2e8],
	["n", 0xc4c3],
	["o", 0xc5b6],
	["p", 0xc5be],
	["q", 0xc6da],
	["r", 0xc8bb],
	["s", 0xc8f6],
	["t", 0xcbfa],
	["w", 0xcdda],
	["x", 0xcef4],
	["y", 0xd1b9],
	["z", 0xd4d1],
];

const FIRST_ROW = 0xb0;
const LAST_ROW = 0xd7;
const FIRST_COLUMN = 0xa1;
const LAST_COLUMN = 0xfe;
/** 一级字在最后一行（D7）只排到 F9。 */
const LAST_ROW_LAST_COLUMN = 0xf9;

const HAN = /[\u3400-\u9fff]/u;

let initials: Map<string, string> | null = null;

function buildInitials(): Map<string, string> {
	const table = new Map<string, string>();
	const bytes: number[] = [];
	for (let row = FIRST_ROW; row <= LAST_ROW; row++) {
		const lastColumn = row === LAST_ROW ? LAST_ROW_LAST_COLUMN : LAST_COLUMN;
		for (let column = FIRST_COLUMN; column <= lastColumn; column++) bytes.push(row, column);
	}
	let characters: string[];
	try {
		characters = Array.from(new TextDecoder("gbk").decode(new Uint8Array(bytes)));
	} catch {
		// 运行时不带 GBK 解码表（精简 ICU）：声母表为空，汉字保持原样参与前缀匹配
		return table;
	}
	let group = 0;
	characters.forEach((character, index) => {
		const code = (bytes[index * 2] << 8) | bytes[index * 2 + 1];
		while (group + 1 < INITIAL_STARTS.length && code >= INITIAL_STARTS[group + 1][1]) group++;
		table.set(character, INITIAL_STARTS[group][0]);
	});
	return table;
}

/**
 * 把文本里的汉字换成拼音声母（小写），其余字符原样保留；不含汉字的文本直接返回。
 *
 * @remarks
 * 只覆盖 GB2312 一级字，多音字按该字表收录的读音归类（如「行」归 x、「长」归 c）；
 * 一级字表之外的生僻字与繁体字没有声母，保持原字。用于菜单项的前缀预测输入。
 *
 * @example
 * pinyinInitials("复制链接"); // "fzlj"
 * pinyinInitials("Move 到系列"); // "Move dxl"
 */
export function pinyinInitials(text: string): string {
	if (!HAN.test(text)) return text;
	initials ??= buildInitials();
	let result = "";
	for (const character of text) result += initials.get(character) ?? character;
	return result;
}
