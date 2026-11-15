#!/usr/bin/env python3
"""Cloud preflight only: never boots a substitute emulator or changes vehicle state."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import platform
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

MANIFEST = "https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-sys-img.xml"
PACKAGE = "system-images;android-34;pleos_car_emulator;x86_64"


def inspect_host() -> dict:
    flags = Path("/proc/cpuinfo").read_text() if Path("/proc/cpuinfo").exists() else ""
    kvm_api = None
    try:
        with open("/dev/kvm", "rb+", buffering=0) as kvm:
            kvm_api = fcntl.ioctl(kvm.fileno(), 0xAE00)  # KVM_GET_API_VERSION
    except OSError:
        pass
    gpu = bool(list(Path("/dev/dri").glob("renderD*"))) or Path("/dev/nvidia0").exists()
    blockers = []
    if platform.machine() not in ("x86_64", "amd64"):
        blockers.append("This preflight targets the official Linux x86_64 image")
    if kvm_api != 12:
        blockers.append("Usable KVM is unavailable; provision nested virtualization and /dev/kvm access")
    if not gpu:
        blockers.append("No GPU device is exposed; provision a Pleos-supported GPU and driver")
    return {
        "os": platform.system(), "architecture": platform.machine(),
        "cpuVirtualizationFlagsExposed": any(f" {flag} " in flags for flag in ("vmx", "svm")),
        "kvmUsable": kvm_api == 12, "gpuDeviceExposed": gpu,
        "blockers": blockers,
        "graphicsRequirementsVerified": False,
        "officialEmulatorBooted": False,
        "note": "A passed host preflight still requires GPU model/driver verification and an official Pleos cold boot.",
    }


def inspect_source() -> dict:
    with urllib.request.urlopen(MANIFEST, timeout=30) as response:
        data = response.read(1_048_577)
    if len(data) > 1_048_576:
        raise ValueError("Unexpectedly large official manifest")
    root = ET.fromstring(data)
    package = next((node for node in root if node.attrib.get("path") == PACKAGE), None)
    if package is None:
        raise ValueError("Expected official image package is missing")
    complete = package.find("./archives/archive/complete")
    if complete is None:
        raise ValueError("Official package has no complete archive")
    archive = urllib.parse.urljoin(MANIFEST, complete.findtext("url", ""))
    if urllib.parse.urlparse(archive).hostname != "nexus-playground.pleos.ai":
        raise ValueError("Image origin changed; review the official documentation before downloading")
    with urllib.request.urlopen(urllib.request.Request(archive, method="HEAD"), timeout=30) as response:
        status = response.status
    return {
        "manifest": MANIFEST, "package": PACKAGE, "archive": archive,
        "declaredBytes": int(complete.findtext("size", "0")),
        "publishedSha1": complete.findtext("checksum"), "archiveHeadStatus": status,
        "downloaded": False, "checksumVerified": False,
        "crnRequiredForPleos210": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-image-source", action="store_true")
    args = parser.parse_args()
    result = inspect_host()
    if args.check_image_source:
        try:
            result["officialImage"] = inspect_source()
        except Exception:
            result["officialImage"] = {"available": False, "reason": "Official source check failed; review source access without exposing credentials"}
            result["blockers"].append("Official image access check did not complete")
    print(json.dumps(result, indent=2))
    return 2 if result["blockers"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
