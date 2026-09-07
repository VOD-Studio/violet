import type { PersonaPublicAsset, PersonaPublicImage } from "@entities/persona/model/types";

export interface PersonaPageLabels {
	profile: string;
	story: string;
	gallery: string;
	continueReading: string;
}

/** 根据当前档案语言切换页面结构文案；未知语言使用英语兜底。 */
export function personaPageLabels(locale: string): PersonaPageLabels {
	if (locale.startsWith("ja")) {
		return {
			profile: "キャラクタープロフィール",
			story: "人物設定",
			gallery: "設定資料",
			continueReading: "続きを読む",
		};
	}
	if (locale.toLowerCase().startsWith("zh-hant")) {
		return {
			profile: "角色檔案",
			story: "人物設定",
			gallery: "設定圖集",
			continueReading: "繼續閱讀",
		};
	}
	if (locale.startsWith("zh")) {
		return {
			profile: "人设档案",
			story: "人物设定",
			gallery: "设定图集",
			continueReading: "向下阅读",
		};
	}
	return {
		profile: "Character profile",
		story: "Character notes",
		gallery: "Reference sheets",
		continueReading: "Read on",
	};
}

/** 为没有替代文本的旧设定图提供稳定的语义描述。 */
export function personaImageAlt(image: PersonaPublicImage, index: number, name: string): string {
	return image.alt_text || `${name} · 第 ${index + 1} 张设定图`;
}

/** 为共享角色头像补足可访问名称。 */
export function personaAvatarAlt(avatar: PersonaPublicAsset, name: string): string {
	return avatar.alt_text || `${name} 的角色头像`;
}

/** 将本名与竖线后的拉丁别名拆开，以分别表达两种视觉语气。 */
export function splitPersonaDisplayName(name: string): { primary: string; alias: string } {
	const [primary, ...aliasParts] = name.split(/[｜|]/u);
	return {
		primary: primary?.trim() || name,
		alias: aliasParts.join(" ").trim(),
	};
}
