import { useSettings } from "@features/settings/api/queries";

/**
 * Footer - 页脚（Nexus 视觉）
 *
 * 极细 1px 顶边 + 字体改 mono。
 * 数据走 useSettings（SSR 预取），展示站点名称、页脚文案与 GitHub 链接。
 */
const Footer = () => {
    const { data } = useSettings();
    const year = new Date().getFullYear();
    const siteName = data?.site_name;
    const footerText = data?.footer_text;
    const githubUsername = data?.github_username;

    return (
        <footer className="border-t border-edge-hairline">
            <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
                <p className="font-mono text-xs text-muted-foreground">
                    © {year} {siteName}
                    {footerText ? ` · ${footerText}` : " · built with obsession"}
                </p>
                {githubUsername ? (
                    <a
                        className="font-mono text-xs text-muted-foreground transition-colors hover:text-neon-blue"
                        href={`https://github.com/${githubUsername}`}
                        target="_blank"
                        rel="noreferrer"
                    >
                        GitHub
                    </a>
                ) : null}
            </div>
        </footer>
    );
};

export default Footer;
