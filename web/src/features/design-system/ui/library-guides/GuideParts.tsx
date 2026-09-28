import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CodeCard } from "@/shared/ui/code-preview/components/CodeCard";

export function GuideSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-4 border-t border-border/60 pt-8">
			<h2 className="text-xl font-bold text-foreground">{title}</h2>
			<div className="space-y-4 text-sm leading-7 text-muted-foreground">{children}</div>
		</section>
	);
}

export function GuideCode({
	code,
	language = "tsx",
	title,
}: {
	code: string;
	language?: string;
	title?: string;
}) {
	return <CodeCard code={code} language={language} title={title} />;
}

export function GuideLink({ to, children }: { to: string; children: ReactNode }) {
	return (
		<Link
			className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
			to={to}
		>
			{children}
		</Link>
	);
}
