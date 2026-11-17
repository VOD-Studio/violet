import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "ci-go-tests.py"
MODULE = "example.test/selector"
INTEGRATION = {
    f"{MODULE}/internal/migrate",
    f"{MODULE}/internal/infrastructure/persistence/gorm/chatappearance",
}
SHARED_CONSUMERS = {
    f"{MODULE}/internal/shared",
    f"{MODULE}/internal/direct",
    f"{MODULE}/internal/transitive",
    f"{MODULE}/internal/testconsumer",
    f"{MODULE}/internal/testinternal",
}


@unittest.skipUnless(shutil.which("go"), "The Go package graph requires a local Go toolchain")
class GoTestPlanTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="violet-go-test-plan-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.environment = {
            **os.environ,
            "GOENV": "off",
            "GOWORK": "off",
            "GOTOOLCHAIN": "local",
            "GOPROXY": "off",
            "GOSUMDB": "off",
            "GOFLAGS": "",
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
        }
        self.command("git", "init", "--quiet")
        self.command("git", "config", "user.email", "ci-selector@example.test")
        self.command("git", "config", "user.name", "CI Selector Tests")
        self.write("scripts/ci-go-tests.py", SCRIPT.read_text())
        self.write("api/go.mod", f"module {MODULE}\n\ngo 1.22\n")
        self.write("api/internal/shared/shared.go", "package shared\n\nconst Value = 1\n")
        self.write(
            "api/internal/direct/direct.go",
            f'package direct\n\nimport "{MODULE}/internal/shared"\n\nconst Value = shared.Value\n',
        )
        self.write(
            "api/internal/transitive/transitive.go",
            f'package transitive\n\nimport "{MODULE}/internal/direct"\n\nconst Value = direct.Value\n',
        )
        self.write("api/internal/testconsumer/consumer.go", "package testconsumer\n")
        self.write(
            "api/internal/testconsumer/consumer_test.go",
            f'package testconsumer_test\n\nimport "{MODULE}/internal/shared"\n\nvar _ = shared.Value\n',
        )
        self.write("api/internal/testinternal/consumer.go", "package testinternal\n")
        self.write(
            "api/internal/testinternal/consumer_test.go",
            f'package testinternal\n\nimport "{MODULE}/internal/shared"\n\nvar _ = shared.Value\n',
        )
        self.write("api/internal/private/private.go", "package private\n\nconst Value = 1\n")
        self.write("api/internal/unrelated/unrelated.go", "package unrelated\n")
        self.write("api/internal/migrate/migrate.go", "package migrate\n")
        self.write(
            "api/internal/migrate/migrate_integration_test.go",
            f'//go:build integration\n\npackage migrate\n\nimport "{MODULE}/internal/shared"\n\nvar _ = shared.Value\n',
        )
        self.write(
            "api/internal/infrastructure/persistence/gorm/chatappearance/store.go",
            "package chatappearance\n",
        )
        self.write(
            "api/internal/infrastructure/persistence/gorm/chatappearance/store_integration_test.go",
            f'//go:build integration\n\npackage chatappearance\n\nimport "{MODULE}/internal/direct"\n\nvar _ = direct.Value\n',
        )
        self.write("api/migrations/001_initial.up.sql", "SELECT 1;\n")
        self.base = self.commit("Initial Go package graph")
        self.all_packages = SHARED_CONSUMERS | INTEGRATION | {
            f"{MODULE}/internal/private", f"{MODULE}/internal/unrelated",
        }

    def command(self, *arguments, cwd=None):
        result = subprocess.run(
            arguments, cwd=cwd or self.root, env=self.environment,
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, f"{arguments!r}\n{result.stdout}\n{result.stderr}")
        return result.stdout.strip()

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

    def commit(self, message):
        self.command("git", "add", "--all")
        self.command("git", "commit", "--quiet", "--message", message)
        return self.command("git", "rev-parse", "HEAD")

    def invoke(self, *arguments, cwd=None):
        output = self.root / ".git" / "plan-output" / "plan.json"
        result = subprocess.run(
            [sys.executable, str(self.root / "scripts/ci-go-tests.py"), "--output", str(output), *arguments],
            cwd=cwd or self.root, env=self.environment, capture_output=True, text=True, check=False,
        )
        return result, output

    def plan(self, *arguments, cwd=None):
        result, output = self.invoke(*arguments, cwd=cwd)
        self.assertEqual(result.returncode, 0, result.stderr)
        planned = json.loads(output.read_text())
        self.assertEqual(planned["version"], 1)
        self.assertEqual(planned["revision"], self.command("git", "rev-parse", "HEAD"))
        for field in ("packages", "integration_packages"):
            self.assertEqual(planned[field], sorted(set(planned[field])))
            self.assertTrue(all(name.startswith(f"{MODULE}/") for name in planned[field]))
        self.assertTrue(planned["reasons"])
        return planned

    def assert_full(self, planned, packages=None):
        self.assertEqual(planned["mode"], "full")
        self.assertEqual(set(planned["packages"]), self.all_packages if packages is None else packages)
        self.assertEqual(set(planned["integration_packages"]), INTEGRATION)

    def test_shared_change_selects_transitive_and_test_only_consumers(self):
        self.write("api/internal/shared/shared.go", "package shared\n\nconst Value = 2\n")
        self.commit("Change shared implementation")
        planned = self.plan("--base", self.base)
        self.assertEqual(planned["mode"], "affected")
        self.assertEqual(set(planned["packages"]), SHARED_CONSUMERS)
        self.assertEqual(set(planned["integration_packages"]), INTEGRATION)

    def test_private_leaf_excludes_unrelated_packages_and_integrations(self):
        self.write("api/internal/private/private.go", "package private\n\nconst Value = 2\n")
        self.commit("Change private implementation")
        planned = self.plan("--base", self.base, cwd=self.root / "api/internal")
        self.assertEqual(planned["mode"], "affected")
        self.assertEqual(planned["packages"], [f"{MODULE}/internal/private"])
        self.assertEqual(planned["integration_packages"], [])

    def test_test_file_change_selects_its_owning_package(self):
        self.write("api/internal/testconsumer/consumer_test.go", "package testconsumer_test\n\nconst TestVersion = 2\n")
        self.commit("Change external test")
        planned = self.plan("--base", self.base)
        self.assertEqual(planned["packages"], [f"{MODULE}/internal/testconsumer"])
        self.assertEqual(planned["integration_packages"], [])

    def test_migration_change_selects_full_backend_and_migration_integrations(self):
        self.write("api/migrations/002_next.up.sql", "SELECT 2;\n")
        self.commit("Add migration")
        self.assert_full(self.plan("--base", self.base))

    def test_migration_deletion_keeps_integration_coverage(self):
        (self.root / "api/migrations/001_initial.up.sql").unlink()
        self.commit("Remove migration")
        self.assert_full(self.plan("--base", self.base))

    def test_default_and_explicit_full_modes_include_all_packages(self):
        for arguments in ((), ("--full",)):
            with self.subTest(arguments=arguments):
                self.assert_full(self.plan(*arguments))

    def test_deleted_file_in_existing_package_keeps_reverse_dependency_coverage(self):
        self.write("api/internal/shared/obsolete.go", "package shared\n\nconst Obsolete = 1\n")
        base = self.commit("Add obsolete shared file")
        (self.root / "api/internal/shared/obsolete.go").unlink()
        self.commit("Remove obsolete shared file")
        planned = self.plan("--base", base)
        self.assertEqual(planned["mode"], "affected")
        self.assertEqual(set(planned["packages"]), SHARED_CONSUMERS)
        self.assertEqual(set(planned["integration_packages"]), INTEGRATION)

    def test_deleted_package_falls_back_instead_of_losing_old_consumers(self):
        (self.root / "api/internal/private/private.go").unlink()
        self.commit("Remove private package")
        self.assert_full(
            self.plan("--base", self.base),
            self.all_packages - {f"{MODULE}/internal/private"},
        )

    def test_rename_within_package_retains_consumers(self):
        (self.root / "api/internal/shared/shared.go").rename(self.root / "api/internal/shared/renamed.go")
        self.commit("Rename shared source")
        planned = self.plan("--base", self.base)
        self.assertEqual(planned["mode"], "affected")
        self.assertEqual(set(planned["packages"]), SHARED_CONSUMERS)
        self.assertEqual(set(planned["integration_packages"]), INTEGRATION)

    def test_renamed_package_keeps_conservative_coverage(self):
        (self.root / "api/internal/private").rename(self.root / "api/internal/moved")
        self.commit("Move private package")
        self.assert_full(
            self.plan("--base", self.base),
            self.all_packages - {f"{MODULE}/internal/private"} | {f"{MODULE}/internal/moved"},
        )

    def test_merge_base_includes_all_pr_commits(self):
        self.write("api/internal/private/private.go", "package private\n\nconst Value = 2\n")
        self.commit("First PR change")
        self.write("api/internal/testconsumer/consumer_test.go", "package testconsumer_test\n")
        self.commit("Second PR change")
        planned = self.plan("--base", self.base)
        self.assertEqual(set(planned["packages"]), {
            f"{MODULE}/internal/private", f"{MODULE}/internal/testconsumer",
        })

    def test_diverged_target_changes_do_not_pollute_pr_diff(self):
        self.command("git", "checkout", "--quiet", "-b", "target-advanced")
        self.write("api/internal/unrelated/unrelated.go", "package unrelated\n\nconst TargetChange = 1\n")
        target = self.commit("Advance target only")
        self.command("git", "checkout", "--quiet", "-b", "pr", self.base)
        self.write("api/internal/private/private.go", "package private\n\nconst Value = 2\n")
        self.commit("Change PR only")
        planned = self.plan("--base", target)
        self.assertEqual(planned["packages"], [f"{MODULE}/internal/private"])

    def test_embedded_resource_selects_package_and_consumers(self):
        self.write(
            "api/internal/shared/shared.go",
            'package shared\n\nimport _ "embed"\n\n//go:embed data/value.txt\nvar Content string\n\nconst Value = 1\n',
        )
        self.write("api/internal/shared/data/value.txt", "first\n")
        base = self.commit("Embed shared data")
        self.write("api/internal/shared/data/value.txt", "second\n")
        self.commit("Change embedded resource")
        planned = self.plan("--base", base)
        self.assertEqual(planned["mode"], "affected")
        self.assertEqual(set(planned["packages"]), SHARED_CONSUMERS)
        self.assertEqual(set(planned["integration_packages"]), INTEGRATION)

    def test_external_test_embed_is_owned_by_its_test_package(self):
        self.write(
            "api/internal/testconsumer/consumer_test.go",
            'package testconsumer_test\n\nimport _ "embed"\n\n//go:embed testdata/input.json\nvar Input string\n',
        )
        self.write("api/internal/testconsumer/testdata/input.json", "{}\n")
        base = self.commit("Embed external test fixture")
        self.write("api/internal/testconsumer/testdata/input.json", '{"value":2}\n')
        self.commit("Change embedded test fixture")
        planned = self.plan("--base", base)
        self.assertEqual(planned["mode"], "affected")
        self.assertEqual(planned["packages"], [f"{MODULE}/internal/testconsumer"])

    def test_deleted_embed_resource_cannot_disappear_from_coverage(self):
        self.write(
            "api/internal/private/private.go",
            'package private\n\nimport "embed"\n\n//go:embed data\nvar Content embed.FS\n',
        )
        self.write("api/internal/private/data/first.txt", "first\n")
        self.write("api/internal/private/data/second.txt", "second\n")
        base = self.commit("Embed resource directory")
        (self.root / "api/internal/private/data/first.txt").unlink()
        self.commit("Delete one embedded resource")
        self.assert_full(self.plan("--base", base))

    def test_config_module_and_environment_changes_require_full_tests(self):
        for name, content in (
            ("api/config.yaml", "port: 9090\n"),
            ("api/go.mod", f"module {MODULE}\n\ngo 1.22\n// changed\n"),
            ("api/go.sum", ""),
            (".env.example", "DATABASE_URL=postgres://example\n"),
            ("scripts/generate-schema.py", "print('schema')\n"),
            ("go.work", "go 1.22\nuse ./api\n"),
        ):
            with self.subTest(name=name):
                self.command("git", "checkout", "--quiet", "--detach", self.base)
                self.write(name, content)
                self.commit(f"Change {name}")
                self.assert_full(self.plan("--base", self.base))

    def test_unknown_backend_resource_handles_unusual_git_filenames(self):
        self.write("api/internal/private/config\nwith space.json", "{}\n")
        self.commit("Add unknown backend input")
        self.assert_full(self.plan("--base", self.base))

    def test_unknown_root_executable_requires_full_tests(self):
        self.write("new-generator.py", "print('generated')\n")
        self.commit("Add unmapped executable")
        self.assert_full(self.plan("--base", self.base))

    def test_added_and_removed_build_constraints_require_full_tests(self):
        self.write("api/internal/private/private.go", "//go:build !integration\n\npackage private\n")
        constrained = self.commit("Constrain private source")
        self.assert_full(self.plan("--base", self.base))
        self.write("api/internal/private/private.go", "package private\n")
        self.commit("Remove source constraint")
        self.assert_full(self.plan("--base", constrained))

    def test_generator_directives_require_full_tests(self):
        self.write("api/internal/private/private.go", "package private\n\n//go:generate go run ../../generator\n")
        self.commit("Add generation directive")
        self.assert_full(self.plan("--base", self.base))

    def test_integration_only_test_change_retains_tagged_test_run(self):
        self.write(
            "api/internal/migrate/migrate_integration_test.go",
            "//go:build integration\n\npackage migrate\n\nconst UpdatedIntegration = 2\n",
        )
        self.commit("Change integration test")
        self.assert_full(self.plan("--base", self.base))

    def test_incomplete_graph_fails_safe_to_full(self):
        self.write(
            "api/internal/direct/direct.go",
            'package direct\n\nimport _ "example.test/missing/dependency"\n\nconst Value = 1\n',
        )
        self.commit("Introduce unresolved dependency")
        self.assert_full(self.plan("--base", self.base))

    def test_missing_base_fails_safe_to_full(self):
        self.assert_full(self.plan("--base", "missing-reference"))

    def test_web_and_documentation_only_changes_have_empty_affected_plan(self):
        self.write("web/src/app.ts", "export const app = 1;\n")
        self.write("docs/guide.md", "# A guide\n")
        self.write("api/internal/private/README.md", "# Private package\n")
        self.commit("Change frontend and documentation")
        planned = self.plan("--base", self.base)
        self.assertEqual(planned["mode"], "affected")
        self.assertEqual(planned["packages"], [])
        self.assertEqual(planned["integration_packages"], [])

    def test_empty_diff_is_an_explicit_no_work_plan(self):
        planned = self.plan("--base", self.base)
        self.assertEqual(planned["mode"], "affected")
        self.assertEqual(planned["packages"], [])
        self.assertEqual(planned["integration_packages"], [])

    def test_conflicting_modes_and_broken_inventory_fail_without_a_plan(self):
        result, output = self.invoke("--full", "--base", self.base)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(output.exists())
        (self.root / "api/go.mod").unlink()
        result, output = self.invoke("--full")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
