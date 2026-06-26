import { TiltedCard } from "@shared/ui/tilted-card";
import { createFileRoute } from "@tanstack/react-router";

const mockProjects = [
	{ id: 1, title: "Nexus Blog", desc: "A geeky, aesthetic blog system." },
	{ id: 2, title: "Fluid UI", desc: "React component library." },
];

const ProjectsPage = () => {
	return (
		<div className="container mx-auto px-6 py-32 min-h-screen">
			<h1 className="text-4xl font-bold mb-16 tracking-tight">Projects</h1>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
				{mockProjects.map((p) => (
					<TiltedCard key={p.id} className="h-64">
						<div className="h-full rounded-3xl border border-edge-hairline p-8 hover:bg-muted/50 transition-colors">
							<h3 className="text-2xl font-bold mb-4">{p.title}</h3>
							<p className="text-muted-foreground">{p.desc}</p>
						</div>
					</TiltedCard>
				))}
			</div>
		</div>
	);
};

export const Route = createFileRoute("/projects/")({
	component: ProjectsPage,
});
