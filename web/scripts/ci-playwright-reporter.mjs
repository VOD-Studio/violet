import { writeFileSync } from "node:fs";
import { relative } from "node:path";

/** Captures list inventories and real per-file test work without using URL dependency guesses. */
export default class CiPlaywrightReporter {
	tests = [];
	errors = [];

	onBegin(_config, suite) {
		this.tests = suite.allTests();
	}

	onError(error) {
		this.errors.push(error.message);
	}

	onEnd(result) {
		const byFile = new Map();
		for (const test of this.tests) {
			const file = relative(process.env.CI_TEST_WEB_ROOT, test.location.file);
			const entry = byFile.get(file) ?? { file, tests: 0, executed: 0, success: true, healthy: true, durationMs: 0 };
			entry.tests += 1;
			const attempts = test.results.filter((attempt) => attempt.status !== "skipped");
			if (attempts.length > 0) {
				entry.executed += 1;
			}
			entry.success &&= test.ok();
			entry.healthy &&= test.repeatEachIndex === 0 &&
				(attempts.length === 0 || (attempts.length === 1 && attempts[0].retry === 0 && attempts[0].status === "passed" && test.expectedStatus === "passed"));
			entry.durationMs += attempts.reduce((total, attempt) => total + attempt.duration, 0);
			byFile.set(file, entry);
		}
		const files = [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file));
		writeFileSync(process.env.CI_TEST_REPORT, JSON.stringify({ version: 1, kind: "contract", success: result.status === "passed" && this.errors.length === 0 && files.every((file) => file.success), files }, null, 2));
	}
}
