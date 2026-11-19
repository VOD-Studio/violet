import violetCover from "./violet-cover.webp";

const coverTitle = "absolute inset-s-[7.4%] font-mono font-medium tracking-tight";
const kanbanColumns = [
	{ name: "计划", heights: [28, 40, 28] },
	{ name: "进行中", heights: [40, 28] },
	{ name: "完成", heights: [28, 28] },
];

/** 项目自身的插画；不承载状态、版本或路线图数据。 */
export function ProjectCoverArt({ slug, title }: { slug: string; title: string }) {
	switch (slug) {
		case "violet":
			return <img src={violetCover} alt="" className="size-full object-cover object-top" />;
		case "kite":
			return (
				<span className="relative block size-full bg-[color-mix(in_oklab,var(--decoration)_9%,var(--card))] text-foreground">
					<svg
						viewBox="0 0 544 300"
						aria-hidden="true"
						className="absolute inset-0 size-full"
					>
						<path
							d="M392 52 450 120 392 214 334 120Z"
							fill="color-mix(in oklab, var(--decoration) 30%, var(--card))"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinejoin="round"
						/>
						<path
							d="M392 52v162M334 120h116M392 214c-10 30 30 34 14 62s-50 16-62 36"
							fill="none"
							stroke="currentColor"
							strokeOpacity=".58"
						/>
						<path
							d="M398 246l12-6M380 282l-12-4"
							stroke="var(--decoration)"
							strokeWidth="3"
						/>
					</svg>
					<span
						className={`${coverTitle} bottom-[12%] text-[clamp(2rem,6vw,4.75rem)] leading-none`}
					>
						kite
					</span>
				</span>
			);
		case "inkline":
			return (
				<span className="relative block size-full bg-muted">
					<svg
						viewBox="0 0 544 300"
						aria-hidden="true"
						className="absolute inset-0 size-full"
						fill="none"
						stroke="currentColor"
						strokeLinecap="round"
					>
						<path
							d="M40 210c40-6 52-62 92-60s46 50 88 48 50-92 94-96 48 66 92 64 44-58 98-60"
							strokeWidth="2.4"
						/>
						<path
							d="M42 214c41-8 50-60 91-58s47 47 87 45 51-88 93-92 49 63 93 61 43-55 97-57"
							strokeOpacity=".35"
						/>
						<circle cx="314" cy="102" r="6" fill="var(--decoration)" stroke="none" />
					</svg>
					<span className={`${coverTitle} top-[11%] text-4xl leading-none`}>inkline</span>
				</span>
			);
		case "kanban":
			return (
				<span className="relative block size-full bg-muted">
					<span className={`${coverTitle} top-[11%] text-4xl leading-none`}>kanban</span>
					<svg
						viewBox="0 0 544 300"
						aria-hidden="true"
						className="absolute inset-0 size-full"
					>
						{kanbanColumns.map(({ name, heights }, column) => {
							const x = 40 + column * 160;
							let y = 125;
							return (
								<g key={name}>
									<rect
										x={x}
										y="88"
										width="144"
										height="166"
										rx="10"
										fill="var(--background)"
									/>
									<text
										x={x + 10}
										y="111"
										fill="var(--muted-foreground)"
										fontSize="12"
									>
										{name}
									</text>
									{heights.map((height) => {
										const top = y;
										y += height + 10;
										return (
											<rect
												key={top}
												x={x + 10}
												y={top}
												width="124"
												height={height}
												rx="6"
												fill="var(--card)"
											/>
										);
									})}
								</g>
							);
						})}
						<circle cx="327" cy="139" r="3.5" fill="var(--decoration)" />
					</svg>
				</span>
			);
		default:
			return (
				<span
					data-testid="project-cover-placeholder"
					className="grid size-full place-items-center font-mono text-4xl font-bold text-muted-foreground/70 sm:text-6xl"
				>
					{title.slice(0, 1).toUpperCase()}
				</span>
			);
	}
}
