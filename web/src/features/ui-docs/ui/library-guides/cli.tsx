import guideSource from "./content/cli.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

/** 命令行章节：构建、打包与 tarball 安装命令，无专用 CLI。 */
export default function CliGuide() {
	return <MarkdownGuideDoc source={guideSource} />;
}
