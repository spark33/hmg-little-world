#!/usr/bin/env python3
"""Stage an authorized signed vehicle release; static staging never attests Pleos runtime."""
import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_NAME = "박상현_ROAMY_release.apk"
REPORT_NAME = "박상현_ROAMY_release.verification.json"
CHECKSUM_NAME = ARTIFACT_NAME + ".sha256"


class StagingError(ValueError):
    """A controlled rejection; messages must not contain credentials or certificate identities."""


def fingerprint(value: str) -> str:
    normalized = re.sub(r"[\s:]", "", value).lower()
    if re.fullmatch(r"[0-9a-f]{64}", normalized) is None:
        raise StagingError("Set ROAMY_RELEASE_CERT_SHA256 to the owner-approved release certificate SHA-256 fingerprint")
    return normalized


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run_capture(command: list[str], description: str) -> str:
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        # Tool output can contain signing identities. Keep it out of staging logs.
        raise StagingError(description + " failed; inspect the private build separately")
    return result.stdout


def verify_snapshot(apk: Path, web_dir: Path, build_tools: Path, approved_signer: str) -> dict:
    output = run_capture([
        sys.executable, str(PROJECT_ROOT / "scripts/verify-apk.py"), str(apk),
        "--web-dir", str(web_dir), "--build-tools", str(build_tools), "--release",
    ], "Signed vehicle release verification")
    try:
        verified = json.loads(output)
    except (ValueError, TypeError) as error:
        raise StagingError("Release verifier returned an unreadable result") from error
    if not isinstance(verified, dict) or verified.get("package") != "ai.littleworld" or \
            verified.get("signatureVerified") is not True or \
            verified.get("releaseCertificateRequired") is not True or \
            verified.get("unsignedInspectionOnly") is not False or \
            verified.get("runtimeValidated") is not False or \
            type(verified.get("webFilesMatched")) is not int or verified["webFilesMatched"] < 1:
        raise StagingError("Release verifier did not establish the required static checks")
    digest = file_hash(apk)
    if verified.get("sha256") != digest:
        raise StagingError("Verified APK bytes changed before staging")
    certificates = run_capture([
        str(build_tools / "apksigner"), "verify", "--print-certs", str(apk),
    ], "Release signer verification")
    signers = re.findall(r"^Signer #\d+ certificate SHA-256 digest:\s*([0-9a-fA-F:]+)\s*$", certificates, re.MULTILINE)
    if len(signers) != 1 or not hmac.compare_digest(fingerprint(signers[0]), approved_signer):
        raise StagingError("APK signer does not match the owner-approved release certificate")
    return {
        "artifactFilename": ARTIFACT_NAME,
        "package": "ai.littleworld",
        "sha256": digest,
        "signatureVerified": True,
        "authorizedSignerMatched": True,
        "webFilesMatched": verified["webFilesMatched"],
        "runtimeValidated": False,
        "pleosRuntimeValidation": "not-attested-by-static-staging",
        "competitionAcceptance": "not-established",
    }


def stage_release(apk: Path, web_dir: Path, build_tools: Path, output_dir: Path, approved_signer: str) -> dict:
    if not apk.is_file():
        raise StagingError("Signed vehicle release APK is missing; build it with authorized release signing first")
    approved = fingerprint(approved_signer)
    targets = [output_dir / name for name in (ARTIFACT_NAME, REPORT_NAME, CHECKSUM_NAME)]
    if any(path.exists() or path.is_symlink() for path in targets):
        raise StagingError("Staged output already exists; archive it explicitly before staging another release")
    # Verify an immutable private copy, never one APK followed by copying possibly changed source bytes.
    with tempfile.TemporaryDirectory(prefix="roamy-release-verification-") as private:
        snapshot = Path(private) / "vehicle-release.apk"
        shutil.copyfile(apk, snapshot)
        report = verify_snapshot(snapshot, web_dir, build_tools, approved)
        output_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".roamy-staging-", dir=output_dir) as pending:
            prepared = Path(pending)
            shutil.copyfile(snapshot, prepared / ARTIFACT_NAME)
            if file_hash(prepared / ARTIFACT_NAME) != report["sha256"]:
                raise StagingError("Staging copy differs from verified APK bytes")
            (prepared / REPORT_NAME).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            (prepared / CHECKSUM_NAME).write_text(report["sha256"] + "  " + ARTIFACT_NAME + "\n", encoding="utf-8")
            created: list[tuple[Path, Path]] = []
            try:
                for target in targets:
                    source = prepared / target.name
                    # link() fails atomically if a target appears; never overwrite an existing artifact.
                    os.link(source, target)
                    created.append((source, target))
            except OSError:
                for source, target in reversed(created):
                    if target.exists() and os.path.samestat(source.stat(), target.stat()):
                        target.unlink()
                raise StagingError("Could not publish staged files atomically; existing output was preserved") from None
        return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", nargs="?", type=Path,
                        default=PROJECT_ROOT / "android/app/build/outputs/apk/vehicle/release/app-vehicle-release.apk")
    parser.add_argument("--web-dir", type=Path, default=PROJECT_ROOT / "web/dist")
    parser.add_argument("--build-tools", type=Path)
    parser.add_argument("--output-dir", type=Path, default=PROJECT_ROOT / "apk")
    args = parser.parse_args()
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    tools = args.build_tools or (Path(sdk) / "build-tools/35.0.0" if sdk else None)
    try:
        if not args.apk.is_file():
            raise StagingError("Signed vehicle release APK is missing; build it with authorized release signing first")
        if tools is None:
            raise StagingError("Set ANDROID_HOME or pass --build-tools for the required Android verifier")
        report = stage_release(args.apk, args.web_dir, tools, args.output_dir,
                               os.environ.get("ROAMY_RELEASE_CERT_SHA256", ""))
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print("Signed vehicle APK staged. Official Pleos validation and organizer acceptance remain separate.")
        return 0
    except (StagingError, OSError) as error:
        message = str(error) if isinstance(error, StagingError) else "A required filesystem or Android tool operation failed"
        print("Competition APK staging rejected: " + message, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
