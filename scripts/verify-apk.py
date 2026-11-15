#!/usr/bin/env python3
"""Verify a built APK and its bundled web output without logging signing identities."""
import argparse
import hashlib
import html
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile


def run_tool(tool: Path, *args: str) -> str:
    result = subprocess.run([str(tool), *args], text=True, capture_output=True)
    if result.returncode:
        raise ValueError(f"{tool.name} verification failed (exit {result.returncode}); inspect the local build separately")
    return result.stdout


def verify(apk: Path, web_dir: Path, tools: Path, release: bool, unsigned: bool = False) -> dict:
    if not apk.is_file() or not web_dir.is_dir():
        raise ValueError("APK and production web output must exist")
    badging = run_tool(tools / "aapt", "dump", "badging", str(apk))
    package = re.search(r"^package: name='([^']+)'", badging, re.MULTILINE)
    if not package or package[1] not in ("ai.littleworld", "ai.littleworld.preview"):
        raise ValueError("Unexpected package identity")
    manifest = run_tool(tools / "aapt", "dump", "xmltree", str(apk), "AndroidManifest.xml")
    if 'usesCleartextTraffic' not in manifest or re.search(r"usesCleartextTraffic.*=\(type 0x12\)0x0\b", manifest) is None:
        raise ValueError("Cleartext traffic must be explicitly disabled")
    if re.search(r"allowBackup.*=\(type 0x12\)0x0\b", manifest) is None:
        raise ValueError("Automatic backup must be disabled")
    if 'appCategory' not in manifest or re.search(r"appCategory.*=\(type 0x10\)0x0\b", manifest) is None:
        raise ValueError("Manifest category must be game")
    if "distractionOptimized" in manifest:
        raise ValueError("Stationary entertainment must not declare distraction optimization")
    permissions = re.findall(r"^uses-permission: name='([^']+)'", badging, re.MULTILINE)
    approved = {"pleos.car.permission.NAVI_ROUTE_SEARCH"}
    if set(permissions) - approved:
        raise ValueError("Unexpected permissions require explicit review before release")
    signed = "" if unsigned else run_tool(tools / "apksigner", "verify", "--print-certs", str(apk))
    if release:
        if package[1] != "ai.littleworld" or "application-debuggable" in badging:
            raise ValueError("Distribution APK must be a non-debuggable vehicle build")
        if "CN=Android Debug" in signed:
            raise ValueError("Distribution APK uses a debug certificate")
    with zipfile.ZipFile(apk) as archive:
        expected = {"assets/web/" + p.relative_to(web_dir).as_posix(): p for p in web_dir.rglob("*") if p.is_file()}
        bundled = {n for n in archive.namelist() if n.startswith("assets/web/") and not n.endswith("/")}
        if bundled != set(expected):
            raise ValueError("APK web asset inventory differs from the production build")
        for name, source in expected.items():
            if archive.read(name) != source.read_bytes():
                raise ValueError("A bundled web asset differs from production output")
        document = html.unescape(archive.read("assets/web/index.html").decode("utf-8"))
        if "Content-Security-Policy" not in document or "script-src 'self'" not in document:
            raise ValueError("Production content policy is missing")
    return {
        "package": package[1], "sha256": hashlib.sha256(apk.read_bytes()).hexdigest(),
        "signatureVerified": not unsigned, "releaseCertificateRequired": release,
        "unsignedInspectionOnly": unsigned,
        "webFilesMatched": len(expected), "permissions": permissions,
        "runtimeValidated": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    parser.add_argument("--web-dir", type=Path, default=Path(__file__).resolve().parents[1] / "web/dist")
    parser.add_argument("--build-tools", type=Path)
    signing = parser.add_mutually_exclusive_group()
    signing.add_argument("--release", action="store_true")
    signing.add_argument("--unsigned", action="store_true", help="Inspect unsigned artifacts only; does not verify signing")
    args = parser.parse_args()
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    tools = args.build_tools or (Path(sdk) / "build-tools/35.0.0" if sdk else None)
    if not tools:
        parser.error("Set ANDROID_HOME or pass --build-tools")
    try:
        print(json.dumps(verify(args.apk.resolve(), args.web_dir.resolve(), tools, args.release, args.unsigned), indent=2))
        return 0
    except (ValueError, OSError, zipfile.BadZipFile) as error:
        print(f"APK verification failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
