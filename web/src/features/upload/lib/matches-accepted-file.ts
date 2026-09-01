/** 按 input accept 语法校验文件，覆盖拖放绕过原生文件选择器的路径。 */
export function matchesAcceptedFile(file: File, accept: string): boolean {
	const rules = accept
		.split(",")
		.map((rule) => rule.trim().toLowerCase())
		.filter(Boolean);
	if (rules.length === 0) return true;

	const mimeType = file.type.toLowerCase();
	const fileName = file.name.toLowerCase();
	return rules.some((rule) => {
		if (rule.startsWith(".")) return fileName.endsWith(rule);
		if (rule.endsWith("/*")) return mimeType.startsWith(rule.slice(0, -1));
		return mimeType === rule;
	});
}
