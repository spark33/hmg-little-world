"""Staging policy tests. Synthetic fixtures remain inside temporary directories, never apk/."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "stage-competition-apk.py"
SPEC = importlib.util.spec_from_file_location("stage_competition_apk", SCRIPT)
stage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage)


class StagingTest(unittest.TestCase):
    def setUp(self):
        self.private = tempfile.TemporaryDirectory(prefix="roamy-staging-unit-")
        self.addCleanup(self.private.cleanup)
        self.root = Path(self.private.name)
        self.apk = self.root / "input.apk"
        self.apk.write_bytes(b"synthetic unit fixture; not an Android release")
        self.web = self.root / "web"
        self.web.mkdir()
        self.tools = self.root / "build-tools"
        self.output = self.root / "apk"
        self.approved = "11" * 32

    def report(self, path=None):
        return {
            "artifactFilename": stage.ARTIFACT_NAME,
            "package": "ai.littleworld",
            "sha256": stage.file_hash(path or self.apk),
            "signatureVerified": True,
            "authorizedSignerMatched": True,
            "webFilesMatched": 4,
            "runtimeValidated": False,
            "pleosRuntimeValidation": "not-attested-by-static-staging",
            "competitionAcceptance": "not-established",
        }

    def verifier_result(self):
        return {
            "package": "ai.littleworld", "sha256": stage.file_hash(self.apk),
            "signatureVerified": True, "releaseCertificateRequired": True,
            "unsignedInspectionOnly": False, "runtimeValidated": False, "webFilesMatched": 4,
        }

    @staticmethod
    def completed(output, code=0, error=""):
        return subprocess.CompletedProcess([], code, stdout=output, stderr=error)

    def invoke(self, **kwargs):
        return stage.stage_release(self.apk, self.web, self.tools, self.output,
                                   kwargs.get("approved", self.approved))

    def assert_not_staged(self):
        self.assertFalse((self.output / stage.ARTIFACT_NAME).exists())
        self.assertFalse((self.output / stage.REPORT_NAME).exists())
        self.assertFalse((self.output / stage.CHECKSUM_NAME).exists())

    def test_missing_apk_is_rejected_without_verification_or_output(self):
        self.apk.unlink()
        with patch.object(stage, "verify_snapshot") as verifier:
            with self.assertRaisesRegex(stage.StagingError, "missing"):
                self.invoke()
            verifier.assert_not_called()
        self.assert_not_staged()

    def test_missing_or_malformed_owner_fingerprint_never_stages(self):
        with patch.object(stage, "verify_snapshot") as verifier:
            for value in ("", "not-a-fingerprint", "ab" * 31, "gg" * 32):
                with self.assertRaisesRegex(stage.StagingError, "ROAMY_RELEASE_CERT_SHA256"):
                    self.invoke(approved=value)
            verifier.assert_not_called()
        self.assert_not_staged()

    def test_debug_unsigned_and_stale_assets_fail_before_output_is_created(self):
        for reason in ("debug certificate", "unsigned APK", "production assets differ"):
            with patch.object(stage, "verify_snapshot", side_effect=stage.StagingError(reason)):
                with self.assertRaises(stage.StagingError):
                    self.invoke()
            self.assert_not_staged()

    def test_static_verifier_is_always_called_in_release_mode(self):
        responses = [self.completed(json.dumps(self.verifier_result())), self.completed(
            "Signer #1 certificate DN: private fixture identity\n"
            f"Signer #1 certificate SHA-256 digest: {self.approved}\n")]
        with patch.object(stage.subprocess, "run", side_effect=responses) as tools:
            result = stage.verify_snapshot(self.apk, self.web, self.tools, self.approved)
        command = tools.call_args_list[0].args[0]
        self.assertIn("--release", command)
        self.assertNotIn("--unsigned", command)
        self.assertFalse(result["runtimeValidated"])
        self.assertNotIn("private fixture identity", json.dumps(result))
        self.assertNotIn(self.approved, json.dumps(result))

    def test_wrong_or_multiple_signers_are_rejected_without_exposing_identity(self):
        for certificates in ("Signer #1 certificate SHA-256 digest: " + "22" * 32,
                             "Signer #1 certificate SHA-256 digest: " + self.approved +
                             "\nSigner #2 certificate SHA-256 digest: " + self.approved):
            with patch.object(stage.subprocess, "run", side_effect=[
                    self.completed(json.dumps(self.verifier_result())), self.completed(certificates)]):
                with self.assertRaisesRegex(stage.StagingError, "owner-approved") as error:
                    stage.verify_snapshot(self.apk, self.web, self.tools, self.approved)
            self.assertNotIn(self.approved, str(error.exception))
            self.assert_not_staged()

    def test_unsigned_preview_and_unattested_verifier_results_are_rejected(self):
        for changes in ({"signatureVerified": False}, {"package": "ai.littleworld.preview"},
                        {"releaseCertificateRequired": False}, {"unsignedInspectionOnly": True},
                        {"runtimeValidated": True}, {"webFilesMatched": 0}, {"webFilesMatched": True}):
            verified = {**self.verifier_result(), **changes}
            with patch.object(stage.subprocess, "run", return_value=self.completed(json.dumps(verified))) as tools:
                with self.assertRaisesRegex(stage.StagingError, "static checks"):
                    stage.verify_snapshot(self.apk, self.web, self.tools, self.approved)
                self.assertEqual(1, tools.call_count)
            self.assert_not_staged()

    def test_verifier_failure_does_not_print_private_tool_output(self):
        private = "Signer private identity or credential-like diagnostic"
        with patch.object(stage.subprocess, "run", return_value=self.completed(private, 1, private)):
            with self.assertRaises(stage.StagingError) as error:
                stage.verify_snapshot(self.apk, self.web, self.tools, self.approved)
        self.assertNotIn(private, str(error.exception))
        self.assert_not_staged()

    def test_bytes_changing_after_verification_are_rejected(self):
        verified = {**self.verifier_result(), "sha256": "00" * 32}
        with patch.object(stage.subprocess, "run", return_value=self.completed(json.dumps(verified))):
            with self.assertRaisesRegex(stage.StagingError, "bytes changed"):
                stage.verify_snapshot(self.apk, self.web, self.tools, self.approved)
        self.assert_not_staged()

    def test_immutable_verified_snapshot_is_the_only_staged_copy(self):
        original = self.apk.read_bytes()

        def verify(snapshot, *_):
            self.assertNotEqual(self.apk, snapshot)
            self.apk.write_bytes(b"source changed while the private snapshot was verified")
            return self.report(snapshot)

        with patch.object(stage, "verify_snapshot", side_effect=verify):
            result = self.invoke()
        self.assertEqual(original, (self.output / stage.ARTIFACT_NAME).read_bytes())
        self.assertEqual(hashlib.sha256(original).hexdigest(), result["sha256"])
        report = json.loads((self.output / stage.REPORT_NAME).read_text())
        self.assertFalse(report["runtimeValidated"])
        self.assertEqual("not-established", report["competitionAcceptance"])
        self.assertEqual(result["sha256"] + "  " + stage.ARTIFACT_NAME + "\n",
                         (self.output / stage.CHECKSUM_NAME).read_text())

    def test_existing_artifacts_are_never_overwritten(self):
        self.output.mkdir()
        previous = self.output / stage.ARTIFACT_NAME
        previous.write_bytes(b"existing owner output")
        with patch.object(stage, "verify_snapshot") as verifier:
            with self.assertRaisesRegex(stage.StagingError, "already exists"):
                self.invoke()
            verifier.assert_not_called()
        self.assertEqual(b"existing owner output", previous.read_bytes())

    def test_partial_publication_failure_rolls_back_only_new_files(self):
        self.output.mkdir()
        readme = self.output / "README.md"
        readme.write_text("existing documentation")
        actual_link = stage.os.link
        links = 0

        def link(source, target):
            nonlocal links
            links += 1
            if links == 2:
                raise FileExistsError("concurrent output")
            actual_link(source, target)

        with patch.object(stage, "verify_snapshot", side_effect=lambda snapshot, *_: self.report(snapshot)), \
                patch.object(stage.os, "link", side_effect=link):
            with self.assertRaisesRegex(stage.StagingError, "atomically"):
                self.invoke()
        self.assert_not_staged()
        self.assertEqual("existing documentation", readme.read_text())


if __name__ == "__main__":
    unittest.main()
