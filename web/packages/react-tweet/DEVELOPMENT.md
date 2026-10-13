# Developing @violetjs/react-tweet

This file is for maintainers. Consumer documentation lives in the English/Chinese READMEs and `docs/api*.md`.

## Environment and boundaries

Use Node.js 22.18+ and pnpm; CI uses Node.js 22 and pnpm 10. The scripts are JavaScript and do not require native TypeScript execution. The package runtime requires React 19; the data API uses standard Fetch APIs. Development uses TypeScript, Vitest, esbuild, and Playwright. `react-dom` is a development dependency, not a component-runtime dependency.

- `src/data/`: public data types, loader contracts, safe URL handling; no React.
- `src/fxtwitter/`: fetching and normalization of full text/media.
- `src/syndication/`: official author metadata and visibility checks.
- `src/tweet/`: components, localization, media, private hooks, styles, SVG assets.
- `src/index.ts`: styled entry, importing `styles.css` and re-exporting the unstyled API.
- `src/unstyled.ts`: CSS-free component/type entry.
- `src/api.ts`: React-free data API.
- Tests are colocated; `src/test/` contains test setup and never ships.

Keep implementation imports direct rather than routing them through the public barrel. Source imports use `.ts`/`.tsx`; TypeScript rewrites them to `.js` during compilation. The build emits declarations, copies the two component stylesheets and entry CSS, and copies SVG assets without an SVG module loader. No site-private module or workspace runtime dependency is allowed.

## Commands

From the repository root, run sequentially:

```sh
make react-tweet-check react-tweet-test react-tweet-build
make react-tweet-examples
make react-tweet-consumer
```

Run the repository's Biome check on changed package files before generating final example assets: changing source formatting afterward intentionally invalidates provenance hashes. These are validation commands, not publishing commands. `consumer` packs the package (triggering `prepack`/build), then installs the tarball in an independent temporary project. It never publishes and never requests live tweets. Use `pnpm --dir web --filter @violetjs/react-tweet consumer --keep` to retain that project for diagnosis.

The consumer check requires `pnpm`, `tar`, the installed development tools, and either registry access or cached dependencies. It validates:

- Tarball allowlist, complete CSS/SVG assets, MIT license, and published `main`/`types`/exports.
- Independent package resolution, not a workspace source symlink.
- Bundler and NodeNext declaration consumption without ambient CSS module declarations.
- All README example files typecheck as a consumer.
- Node SSR, server-timezone independence, private-content suppression, async SSR loading, URL parsing, and invalid API input without network calls.
- Production named imports preserve default CSS and all referenced SVG assets.
- `/unstyled` has no CSS/assets; `/api` has neither React nor CSS in its bundle graph.
- README snippets and image provenance match their executable inputs.

This does not replace interactive browser testing of hydration, media, keyboard navigation, text measurement, or host lightboxes. Those component behaviors have their own tests and should also be reviewed in a real host browser when changed. Live adapter tests additionally need access to FxTwitter and X syndication; do not mistake fixture tests for live-provider availability.

## Examples and image provenance

`examples/snapshot.tsx` owns the fictional author/text. `examples/themes.tsx` is the actual component rendered into both README images; English uses `en-US`, Chinese uses `zh-CN`, and the author's English text stays unchanged. `quoted.tsx` reuses that snapshot to demonstrate the small-card layout. No user photo, external avatar, or live post is loaded. `remote.tsx` accepts a host fetcher; `server.tsx` exports a real server function and deliberately requires a caller-supplied real ID rather than pretending the fictional example is a live tweet.

`scripts/sync-readme.mjs` copies complete example source into marked blocks in both READMEs. `--check` is read-only and fails on drift or missing/duplicate markers. Do not edit generated snippet bodies independently.

`scripts/render-examples.mjs` bundles `themes.tsx` with esbuild, replacing only its styled package import with the built unstyled entry for Node SSR. It serves that markup with the **built package CSS and SVGs** in Chromium, then captures the cards. Every network request is intercepted; third-party requests fail. A package-local temporary module is always removed. Use an existing Playwright Chromium installation, or select an existing executable explicitly:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium make react-tweet-examples
```

Browser installation is an explicit maintainer/environment step, not something the generation script silently performs. Rasterization can differ by OS, fonts, and browser version. `docs/images/manifest.json` records SHA-256 for example source, renderer source, every built file, and both PNGs. The read-only `--check` recomputes those hashes without importing Playwright or launching a browser. It proves checked-in images belong to the current generated inputs and detects edited assets; it is not a cross-platform pixel-diff test. Regenerate after changing any hashed input. Commit regenerated PNGs and manifest together.

## Package and publication contract

The source manifest resolves workspace exports to source. pnpm's `publishConfig` rewrites `main`, `types`, and exports to `dist` when packing. Use **pnpm pack/publish**, not an alternate packer that ignores these overrides. The root declaration target is `unstyled.d.ts`, so consumers never need a CSS ambient declaration just to import types.

The styled source and built root entries, plus all CSS, must remain in `sideEffects`; marking the package globally side-effect-free would remove automatic CSS under tree shaking. Do not add CSS to the unstyled/API entry graphs. The tarball contains only `dist`, both READMEs, changelog, license, and package metadata. API docs, screenshots, examples, scripts, test fixtures, and development instructions remain in the repository; README links use public repository URLs so they also work from npm.

Keep the icon attribution in `LICENSE`. Update consumer-facing changelog entries when behavior or packaging changes; do not infer that a version is published just because it appears in the changelog. Version changes, tags, npm credentials, and actual publication require separate authorization. Before publication, the documented repository URLs must resolve on the public integration branch and the publisher must have access to the `@violetjs` scope. Follow the [npm release runbook](../../../docs/deploy/release-runbook.md#npm-独立包发布) for version finalization, workflow dry-run, publication from `release/2.0`, and registry verification. No package development script changes versions, pushes, or publishes.
