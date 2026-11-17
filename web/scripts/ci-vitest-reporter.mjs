import { writeFileSync } from "node:fs";
import { relative } from "node:path";

/** Records runner diagnostics only; failed, retried, or repeated files never seed history. */
export default class CiVitestReporter {
	onTestRunEnd(modules, errors, reason) {
		const files = modules.map((module) => {
			const tests = [...module.children.allTests()];
			const executed = tests.filter((test) => ["passed", "failed"].includes(test.result().state));
			const diagnostic = module.diagnostic();
			const success = module.state() === "passed" && module.ok();
			const healthy = success && executed.length > 0 && executed.every((test) => {
				const result = test.result();
				const measurement = test.diagnostic();
				return result.state === "passed" && !result.errors?.length && measurement?.retryCount === 0 && measurement?.repeatCount === 0;
			});
			return {
				file: relative(process.env.CI_TEST_WEB_ROOT, module.moduleId),
				tests: tests.length,
				executed: executed.length,
				success,
				healthy,
				durationMs: diagnostic.duration + diagnostic.collectDuration + diagnostic.setupDuration + diagnostic.environmentSetupDuration + diagnostic.prepareDuration,
			};
		});
		writeFileSync(process.env.CI_TEST_REPORT, JSON.stringify({ version: 1, kind: "unit", success: errors.length === 0 && reason === "passed" && files.every((file) => file.success), files }, null, 2));
	}
}
