import { githubKeys } from "@features/github/api/keys";
import { fetchContributions } from "@features/github/api/queries";
import Contributions from "@features/github/ui/Contributions";
import { createFileRoute } from "@tanstack/react-router";
import Hero from "@widgets/Hero";

function HomePage() {
	return (
		<div className="flex flex-col min-h-screen">
			<Hero />
			<section className="container mx-auto px-6 py-24 bg-background">
				{/* Bento Grid Posts will go here in next task */}
				<div className="mt-24 border border-edge-hairline rounded-3xl p-8">
					<Contributions />
				</div>
			</section>
		</div>
	);
}

/**
 * / - 首页
 *
 * loader SSR 预取数据：
 * - GitHub 贡献图（底座用）
 *
 * GitHub 贡献图属装饰性次要信息，后端未就绪（如 404）时不应拖垮整页，
 * 故单独 fetch + 容错，失败时底座降级为空（useContributions 自身已是
 * error 降级）。
 *
 * context.queryClient 从 router context 复用（getRouter 注入的单例）。
 */
export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		// 装饰性：单独预取，失败不阻塞（catch 后缓存为空，底座自然降级）
		await context.queryClient
			.ensureQueryData({
				queryKey: githubKeys.contributions(),
				queryFn: fetchContributions,
			})
			.catch(() => {
				/* GitHub 端点未就绪（404 等）→ 贡献区降级，不影响主页 */
			});
	},
	component: HomePage,
});
