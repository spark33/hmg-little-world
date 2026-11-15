"""Media-verifier policy tests use synthetic files only in private temp dirs."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[2] / "web/verify-design-media.py"
SPEC = importlib.util.spec_from_file_location("verify_design_media", SCRIPT)
media = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(media)


class MediaVerificationTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="roamy-media-unit-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.video = self.root / "sample.mp4"
        self.video.write_bytes(b"synthetic verification fixture, not a real movie")
        self.frame = self.root / "review.png"
        self.frame.write_bytes(b"synthetic review fixture, not a real image")
        self.metadata = {
            "codec": "h264", "width": 640, "height": 480, "frameRate": "15/1",
            "durationSeconds": 2.0, "hasAudio": False,
        }
        self.record = {
            "file": self.video.name, "bytes": self.video.stat().st_size,
            "sha256": media.file_hash(self.video), **self.metadata,
            "rawDurationSeconds": 2.02, "fullDecode": "passed",
            "frames": [{"file": self.frame.name, "timestampSeconds": 0.5,
                        "sha256": media.file_hash(self.frame), "inspected": True,
                        "inspectionNote": "Accepted evidence must remain unchanged."}],
        }
        self.manifest = self.root / "media-validation.json"
        self.save_manifest()

    def save_manifest(self):
        self.document = {"method": "accepted historical capture", "videos": [self.record],
                         "allAcceptedScreenshotCount": 1}
        self.manifest.write_text(json.dumps(self.document))

    def snapshot(self):
        return {str(path.relative_to(self.root)): path.read_bytes()
                for path in self.root.rglob("*") if path.is_file()}

    def verify(self, **kwargs):
        with patch.object(media, "probe_media", return_value=self.metadata), \
                patch.object(media, "decode_media"):
            return media.verify_manifest(self.manifest, **kwargs)

    def test_help_performs_no_artifact_io_or_tool_execution(self):
        with patch.object(media, "verify_manifest") as verify, \
                patch.object(Path, "read_text") as read, \
                patch.object(Path, "mkdir") as mkdir, \
                patch.object(media, "run_tool") as tool, \
                contextlib.redirect_stdout(io.StringIO()) as output:
            with self.assertRaises(SystemExit) as exited:
                media.main(["--manifest", "missing-evidence.json", "--help"])
        self.assertEqual(0, exited.exception.code)
        self.assertIn("--compare-raw", output.getvalue())
        for mock in [verify, read, mkdir, tool]:
            mock.assert_not_called()

    def test_default_verification_needs_no_raw_recording_and_never_changes_accepted_files(self):
        before = self.snapshot()
        self.assertFalse(self.video.with_suffix(".webm").exists())
        with patch.object(media, "probe_media", return_value=self.metadata) as probe, \
                patch.object(media, "decode_media") as decode:
            result, accepted = media.verify_manifest(self.manifest)
        self.assertEqual("passed", result["verification"])
        self.assertFalse(result["rawCompared"])
        probe.assert_called_once_with(self.video)
        decode.assert_called_once_with(self.video)
        self.assertTrue(accepted["videos"][0]["frames"][0]["inspected"])
        self.assertEqual(before, self.snapshot())

    def test_same_length_checksum_tampering_fails_before_probe_or_decode(self):
        self.video.write_bytes(b"x" * self.video.stat().st_size)
        before = self.snapshot()
        with patch.object(media, "probe_media") as probe, patch.object(media, "decode_media") as decode:
            with self.assertRaisesRegex(media.VerificationError, "SHA-256 mismatch"):
                media.verify_manifest(self.manifest)
        probe.assert_not_called()
        decode.assert_not_called()
        self.assertEqual(before, self.snapshot())

    def test_missing_raw_is_an_error_only_when_explicitly_requested(self):
        before = self.snapshot()
        with patch.object(media, "probe_media") as probe:
            with self.assertRaisesRegex(media.VerificationError, "missing raw WebM"):
                media.verify_manifest(self.manifest, compare_raw=True)
        probe.assert_not_called()
        self.assertEqual(before, self.snapshot())

    def test_metadata_mismatches_are_rejected_without_mutation(self):
        for field, value in [("codec", "vp9"), ("width", 1280), ("height", 720),
                             ("hasAudio", True), ("frameRate", "30/1"), ("durationSeconds", 2.2)]:
            with self.subTest(field=field):
                before = self.snapshot()
                actual = {**self.metadata, field: value}
                with patch.object(media, "probe_media", return_value=actual), \
                        patch.object(media, "decode_media") as decode:
                    with self.assertRaises(media.VerificationError):
                        media.verify_manifest(self.manifest)
                decode.assert_not_called()
                self.assertEqual(before, self.snapshot())

    def test_frame_rate_equivalents_and_container_rounding_are_accepted(self):
        with patch.object(media, "probe_media", return_value={
                **self.metadata, "frameRate": "30/2", "durationSeconds": 2.000001}), \
                patch.object(media, "decode_media"):
            result, _ = media.verify_manifest(self.manifest)
        self.assertEqual("passed", result["videos"][0]["fullDecode"])

    def test_decode_failure_does_not_reset_inspection_flags_or_notes(self):
        before = self.snapshot()
        with patch.object(media, "probe_media", return_value=self.metadata), \
                patch.object(media, "decode_media", side_effect=media.VerificationError("decode failed")), \
                contextlib.redirect_stderr(io.StringIO()) as error:
            result = media.main(["--manifest", str(self.manifest)])
        self.assertEqual(1, result)
        self.assertIn("decode failed", error.getvalue())
        self.assertEqual(before, self.snapshot())

    def test_raw_comparison_checks_recorded_and_converted_durations(self):
        raw_dir = self.root / "raw"
        raw_dir.mkdir()
        raw = raw_dir / "sample.webm"
        raw.write_bytes(b"synthetic raw fixture")
        with patch.object(media, "probe_media", side_effect=[
                self.metadata, {**self.metadata, "durationSeconds": 2.02}]), \
                patch.object(media, "decode_media"):
            result, _ = media.verify_manifest(self.manifest, compare_raw=True, raw_dir=raw_dir)
        self.assertTrue(result["rawCompared"])
        self.assertAlmostEqual(-0.02, result["videos"][0]["durationDifferenceSeconds"])
        with patch.object(media, "probe_media", side_effect=[
                self.metadata, {**self.metadata, "durationSeconds": 3.0}]), \
                patch.object(media, "decode_media") as decode:
            with self.assertRaisesRegex(media.VerificationError, "raw duration mismatch"):
                media.verify_manifest(self.manifest, compare_raw=True, raw_dir=raw_dir)
            decode.assert_not_called()

    def test_full_decode_limits_threads_and_opens_no_output_file(self):
        with patch.object(media, "run_tool") as tool:
            media.decode_media(self.video)
        command = tool.call_args.args[0]
        thread_values = [command[index + 1] for index, word in enumerate(command) if word == "-threads"]
        self.assertEqual(["1", "1"], thread_values)
        self.assertIn("-xerror", command)
        self.assertEqual(["-f", "null", "-"], command[-3:])
        self.assertNotIn("-y", command)

    def test_review_frame_tampering_and_paths_outside_evidence_are_rejected(self):
        self.frame.write_bytes(b"changed review frame")
        with self.assertRaisesRegex(media.VerificationError, "review-frame checksum"):
            self.verify()
        self.record["file"] = "../outside.mp4"
        self.save_manifest()
        with self.assertRaisesRegex(media.VerificationError, "inside the evidence directory"):
            self.verify()

    def test_explicit_extraction_never_overwrites_existing_review_directory(self):
        before = self.snapshot()
        with patch.object(media, "run_tool") as tool:
            with self.assertRaisesRegex(media.VerificationError, "new output directory"):
                media.extract_frames(self.manifest, self.document, self.root)
        tool.assert_not_called()
        self.assertEqual(before, self.snapshot())

    def test_extraction_is_explicit_and_writes_only_new_frame_files(self):
        output = self.root / "new-extraction"
        accepted = self.manifest.read_bytes()
        with patch.object(media, "run_tool") as tool:
            count = media.extract_frames(self.manifest, self.document, output)
        self.assertEqual(1, count)
        command = tool.call_args.args[0]
        self.assertEqual(str(output / "review.png"), command[-1])
        self.assertIn("-n", command)
        self.assertNotIn("-y", command)
        self.assertEqual(accepted, self.manifest.read_bytes())


if __name__ == "__main__":
    unittest.main()
