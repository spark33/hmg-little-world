"""Regression checks for deterministic attribution inputs and shipping scope."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest

REPOSITORY = Path(__file__).resolve().parents[2]
GENERATOR = REPOSITORY / "scripts/generate-notices.py"
MIT = (REPOSITORY / "docs/licenses/upstream/react-three-fiber-9.8.2-LICENSE.txt").read_bytes()


class NoticeGenerationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.lock = {
            "lockfileVersion": 3,
            "packages": {
                "": {"name": "fixture"},
                "node_modules/alpha": {"version": "1.0.0", "license": "MIT"},
                "node_modules/beta": {"version": "2.0.0", "license": "MIT"},
                "node_modules/dev-only": {"version": "3.0.0", "dev": True},
            },
        }
        for name, version in [("alpha", "1.0.0"), ("beta", "2.0.0")]:
            package = self.root / "web/node_modules" / name
            package.mkdir(parents=True)
            (package / "package.json").write_text(json.dumps({"name": name, "version": version}))
            (package / "LICENSE").write_bytes(MIT)
        self.sources = {"schemaVersion": 1, "npmPackages": {}, "androidLibraries": [], "proprietaryDependencies": []}
        (self.root / "docs/licenses/upstream").mkdir(parents=True)
        self.save_inputs()

    def save_inputs(self):
        (self.root / "web/package-lock.json").write_text(json.dumps(self.lock, sort_keys=True))
        (self.root / "docs/licenses/upstream/sources.json").write_text(json.dumps(self.sources, sort_keys=True))

    def command(self, *args, success=True):
        result = subprocess.run([sys.executable, str(GENERATOR), "--root", str(self.root), *args], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0 if success else 1, result.stdout + result.stderr)
        return result

    def inventory(self):
        return json.loads((self.root / "docs/licenses/runtime-dependencies.json").read_text())

    def bundle(self, paths):
        path = self.root / "bundle.json"
        entries = [{"path": item, "name": item.rsplit("node_modules/", 1)[-1], "version": self.lock["packages"][item]["version"]} for item in paths]
        path.write_text(json.dumps({"schemaVersion": 1, "lockfileSha256": hashlib.sha256((self.root / "web/package-lock.json").read_bytes()).hexdigest(), "packages": entries}))
        return str(path)

    def test_deterministic_outputs_keep_full_license_and_notice_content(self):
        notice = self.root / "web/node_modules/alpha/NOTICE.txt"
        notice.write_bytes(b"Supplementary attribution retained exactly.\r\n")
        self.command()
        before = (self.root / "web/public/third-party-notices.txt").read_bytes()
        self.assertIn(MIT, before)
        self.assertIn(notice.read_bytes().replace(b"\r\n", b"\n"), before)
        record = next(row for row in self.inventory()["packages"] if row["name"] == "alpha")
        self.assertEqual(next(item for item in record["notices"] if item["path"] == "NOTICE.txt")["sha256"], hashlib.sha256(notice.read_bytes()).hexdigest())
        self.assertEqual(self.inventory()["runtimePackageCount"], 2)
        self.command("--check")
        self.command()
        self.assertEqual((self.root / "web/public/third-party-notices.txt").read_bytes(), before)

    def test_missing_full_shipped_license_fails_instead_of_using_metadata_only(self):
        self.command()
        (self.root / "web/node_modules/alpha/LICENSE").unlink()
        result = self.command("--check", success=False)
        self.assertIn("Full license material missing", result.stderr)
        self.assertIn("alpha@1.0.0", result.stderr)

    def test_tampered_license_or_generated_text_is_detected(self):
        self.command()
        notice = self.root / "web/node_modules/alpha/LICENSE"
        notice.write_bytes(MIT + b"\nChanged installed terms.\n")
        self.assertIn("stale or altered", self.command("--check", success=False).stderr)
        notice.write_bytes(MIT)
        output = self.root / "web/public/third-party-notices.txt"
        output.write_bytes(output.read_bytes() + b"tampered")
        self.assertIn("stale or altered", self.command("--check", success=False).stderr)

    def test_changed_runtime_inventory_and_wrong_installed_version_fail(self):
        self.command()
        self.lock["packages"]["node_modules/alpha"]["version"] = "1.0.1"
        self.save_inputs()
        self.assertIn("differs from lockfile", self.command("--check", success=False).stderr)
        (self.root / "web/node_modules/alpha/package.json").write_text(json.dumps({"name": "alpha", "version": "1.0.1"}))
        self.assertIn("stale or altered", self.command("--check", success=False).stderr)

    def test_unused_unresolved_package_is_audited_but_cannot_be_shipped(self):
        (self.root / "web/node_modules/beta/LICENSE").unlink()
        bundle = self.bundle(["node_modules/alpha"])
        self.command("--bundle-inventory", bundle)
        row = next(row for row in self.inventory()["packages"] if row["name"] == "beta")
        self.assertFalse(row["shipped"])
        self.assertEqual(row["noticeStatus"], "unresolved")
        self.assertNotIn(b"beta 2.0.0", (self.root / "web/public/third-party-notices.txt").read_bytes())
        self.command("--check", "--bundle-inventory", bundle)
        changed = self.bundle(["node_modules/alpha", "node_modules/beta"])
        self.assertIn("Full license material missing", self.command("--bundle-inventory", changed, success=False).stderr)

    def test_bundle_inventory_must_match_lock_and_exact_paths(self):
        bundle = self.bundle(["node_modules/alpha"])
        value = json.loads(Path(bundle).read_text())
        value["lockfileSha256"] = "0" * 64
        Path(bundle).write_text(json.dumps(value))
        self.assertIn("lockfile hash", self.command("--bundle-inventory", bundle, success=False).stderr)
        bundle = self.bundle(["node_modules/alpha"])
        value = json.loads(Path(bundle).read_text())
        value["packages"][0]["version"] = "99.0.0"
        Path(bundle).write_text(json.dumps(value))
        self.assertIn("name/version mismatch", self.command("--bundle-inventory", bundle, success=False).stderr)

    def test_pinned_fallback_notice_hash_is_verified(self):
        (self.root / "web/node_modules/alpha/LICENSE").unlink()
        supplement = self.root / "docs/licenses/upstream/alpha-LICENSE.txt"
        supplement.write_bytes(MIT)
        self.sources["npmPackages"]["alpha@1.0.0"] = {"completeLicense": True, "files": [{"path": "docs/licenses/upstream/alpha-LICENSE.txt", "sha256": hashlib.sha256(MIT).hexdigest(), "sourceUrl": "https://example.invalid/upstream/verified-fixture-license", "sourceRef": "fixture-version"}]}
        self.save_inputs()
        self.command()
        supplement.write_bytes(MIT + b"\nchanged")
        self.assertIn("upstream notice hash changed", self.command("--check", success=False).stderr)

    def test_nested_duplicate_versions_have_separate_notices(self):
        location = "node_modules/alpha/node_modules/beta"
        self.lock["packages"][location] = {"version": "1.5.0", "license": "MIT"}
        package = self.root / "web" / location
        package.mkdir(parents=True)
        (package / "package.json").write_text(json.dumps({"name": "beta", "version": "1.5.0"}))
        (package / "LICENSE").write_bytes(MIT)
        self.save_inputs()
        self.command()
        rows = self.inventory()["packages"]
        self.assertEqual(len(rows), 3)
        parent = next(row for row in rows if row["name"] == "alpha")
        self.assertEqual([notice["path"] for notice in parent["notices"]], ["LICENSE"])
        output = (self.root / "web/public/third-party-notices.txt").read_text()
        self.assertIn("beta 1.5.0", output)
        self.assertIn("beta 2.0.0", output)


if __name__ == "__main__":
    unittest.main()
