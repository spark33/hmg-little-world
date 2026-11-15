#!/usr/bin/env python3
"""Build reproducible attribution material from the installed npm lock graph.

No network access is performed. Upstream supplements are pinned, reviewed inputs.
A bundle inventory limits shipping scope; without it every installed non-dev entry
is conservatively treated as shipped. Missing full license material then fails.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys

SCHEMA_VERSION = 1
INVENTORY = Path("docs/licenses/runtime-dependencies.json")
NOTICES = Path("web/public/third-party-notices.txt")
SOURCES = Path("docs/licenses/upstream/sources.json")
MAX_NOTICE_BYTES = 2 * 1024 * 1024


class NoticeError(ValueError):
    pass


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise NoticeError(f"Cannot read JSON input {path}: {error}") from error


def json_text(value) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def safe_relative(value: str) -> Path:
    path = Path(value)
    if path.is_absolute() or ".." in path.parts or not value:
        raise NoticeError(f"Unsafe relative notice path: {value}")
    return path


def notice_bytes(path: Path) -> bytes:
    try:
        data = path.read_bytes()
        if not data.strip() or len(data) > MAX_NOTICE_BYTES:
            raise NoticeError(f"Empty or oversized notice text: {path}")
        data.decode("utf-8")
        return data
    except (OSError, UnicodeError) as error:
        raise NoticeError(f"Cannot read full UTF-8 notice text {path}: {error}") from error


def appears_complete(data: bytes) -> bool:
    text = data.decode("utf-8").lower()
    return len(text) >= 300 and any(term in text for term in (
        "permission is hereby granted", "permission to use, copy", "apache license",
        "redistribution and use", "public domain", "gnu general public license",
    ))


def package_notice_files(package: Path):
    result = []
    for directory, children, files in os.walk(package):
        children[:] = sorted(name for name in children if name != "node_modules")
        for name in sorted(files):
            if not re.match(r"^(licen[cs]e|copying|notice)(?:$|[._-])", name, re.I):
                continue
            path = Path(directory) / name
            if not path.resolve().is_relative_to(package.resolve()):
                raise NoticeError(f"Notice symlink leaves its package: {path}")
            result.append(path)
    return sorted(result, key=lambda path: path.relative_to(package).as_posix())


def pinned_notice(root: Path, source: dict):
    path = safe_relative(source["path"])
    if path.parts[:3] != ("docs", "licenses", "upstream"):
        raise NoticeError(f"Pinned license must be under docs/licenses/upstream: {path}")
    data = notice_bytes(root / path)
    if sha256(data) != source.get("sha256"):
        raise NoticeError(f"Pinned upstream notice hash changed: {path}")
    if not str(source.get("sourceUrl", "")).startswith("https://"):
        raise NoticeError(f"Missing HTTPS provenance for {path}")
    return {
        "origin": "pinned-upstream", "path": path.as_posix(),
        "sha256": sha256(data), "sourceUrl": source["sourceUrl"],
        "sourceRef": source.get("sourceRef"),
        "versionProvenance": source.get("versionProvenance"),
    }, data


def bundle_scope(root: Path, lock: dict, bundle_path: Path | None):
    if bundle_path is None:
        return None, {"kind": "conservative-installed-non-dev", "sha256": None}
    value = read_json(bundle_path)
    lock_hash = sha256((root / "web/package-lock.json").read_bytes())
    if value.get("schemaVersion") != 1 or value.get("lockfileSha256") != lock_hash:
        raise NoticeError("Bundle inventory schema or lockfile hash does not match")
    packages = value.get("packages")
    if not isinstance(packages, list):
        raise NoticeError("Bundle inventory must list exact lockfile package paths")
    selected = set()
    for package in packages:
        if not isinstance(package, dict):
            raise NoticeError("Bundle inventory entries need path, name and version")
        path = package.get("path", package.get("packagePath"))
        if not isinstance(path, str) or path not in lock["packages"]:
            raise NoticeError(f"Unknown bundled package path: {path}")
        metadata = lock["packages"][path]
        name = path.rsplit("node_modules/", 1)[-1]
        if package.get("name") != name or package.get("version") != metadata.get("version"):
            raise NoticeError(f"Bundle package name/version mismatch: {path}")
        if metadata.get("dev", False):
            raise NoticeError(f"Bundled development-only package needs explicit review: {path}")
        if path in selected:
            raise NoticeError(f"Duplicate bundled package path: {path}")
        selected.add(path)
    return selected, {"kind": "emitted-javascript-package-inventory", "sha256": sha256(bundle_path.read_bytes())}


def collect(root: Path, bundle_path: Path | None = None):
    lock = read_json(root / "web/package-lock.json")
    if lock.get("lockfileVersion") not in (2, 3) or not isinstance(lock.get("packages"), dict):
        raise NoticeError("A package-lock v2/v3 packages inventory is required")
    sources = read_json(root / SOURCES)
    if sources.get("schemaVersion") != SCHEMA_VERSION:
        raise NoticeError("Unsupported attribution source manifest")
    selected, scope = bundle_scope(root, lock, bundle_path)
    packages, material, omitted = [], {}, []
    unresolved = []
    for location, metadata in sorted(lock["packages"].items()):
        if not location or metadata.get("dev", False):
            continue
        relative = safe_relative(location)
        if relative.parts[0] != "node_modules":
            raise NoticeError(f"Unexpected runtime package location: {location}")
        package_root = root / "web" / relative
        if not package_root.exists():
            if metadata.get("optional") and (selected is None or location not in selected):
                omitted.append({"path": location, "version": metadata.get("version")})
                continue
            raise NoticeError(f"Runtime package is not installed: {location}; run npm ci")
        package = read_json(package_root / "package.json")
        name = location.rsplit("node_modules/", 1)[-1]
        version = metadata.get("version")
        if package.get("name") != name or package.get("version") != version:
            raise NoticeError(f"Installed package differs from lockfile: {location}")
        declared = metadata.get("license", package.get("license"))
        records, texts = [], []
        complete = False
        for file in package_notice_files(package_root):
            data = notice_bytes(file)
            rel = file.relative_to(package_root).as_posix()
            records.append({"origin": "installed-package", "path": rel, "sha256": sha256(data)})
            texts.append((f"Installed package file: {rel}", data))
            if re.match(r"^(licen[cs]e|copying)(?:$|[._-])", file.name, re.I) and appears_complete(data):
                complete = True
        supplement = sources.get("npmPackages", {}).get(f"{name}@{version}", {})
        notes = list(supplement.get("reviewNotes", []))
        for source in supplement.get("files", []):
            record, data = pinned_notice(root, source)
            records.append(record)
            texts.append((f"Upstream supplement: {record['sourceUrl']}", data))
            if supplement.get("completeLicense", False) and appears_complete(data):
                complete = True
        for embedded in supplement.get("embedded", []):
            path = safe_relative(embedded["path"])
            file = package_root / path
            data = notice_bytes(file)
            if sha256(data) != embedded.get("sha256"):
                raise NoticeError(f"Embedded notice source changed: {name}/{path}")
            blocks = sorted(set(block for block in re.findall(r"/\*[\s\S]*?\*/", data.decode("utf-8"))
                                if embedded["marker"] in block and ("icense" in block or "Permission is hereby granted" in block)))
            if not blocks:
                raise NoticeError(f"No expected embedded notice found: {name}/{path}")
            for index, block in enumerate(blocks, 1):
                text = block.encode("utf-8")
                records.append({"origin": "installed-source-comment", "path": path.as_posix(),
                                "sourceSha256": sha256(data), "noticeIndex": index, "sha256": sha256(text)})
                texts.append((f"Preserved license comment {index} from installed source: {path}", text))
        shipped = selected is None or location in selected
        status = "resolved" if complete else "unresolved"
        if shipped and not complete:
            unresolved.append(f"{name}@{version} ({location})")
        row = {
            "path": location, "name": name, "version": version,
            "declaredLicense": declared, "integrity": metadata.get("integrity"),
            "resolved": metadata.get("resolved"), "repository": package.get("repository"),
            "authorMetadata": package.get("author"), "shipped": shipped,
            "noticeStatus": status, "notices": records, "reviewNotes": notes,
        }
        packages.append(row)
        material[location] = texts
    if selected is not None and not selected.issubset({package["path"] for package in packages}):
        raise NoticeError("Bundle inventory includes an unavailable runtime dependency")
    android = []
    for library in sources.get("androidLibraries", []):
        records, texts = [], []
        for source in library.get("files", []):
            record, data = pinned_notice(root, source)
            records.append(record)
            texts.append((f"Android library license source: {record['sourceUrl']}", data))
        if not texts or not any(appears_complete(data) for _, data in texts):
            raise NoticeError(f"Missing Android library full license text: {library.get('name')}")
        android.append({key: value for key, value in library.items() if key != "files"} | {"notices": records})
        material[f"android:{library['name']}"] = texts
    inventory = {
        "schemaVersion": SCHEMA_VERSION,
        "scope": scope,
        "lockfileSha256": sha256((root / "web/package-lock.json").read_bytes()),
        "sourceManifestSha256": sha256((root / SOURCES).read_bytes()),
        "runtimePackageCount": len(packages), "shippedPackageCount": sum(row["shipped"] for row in packages),
        "packages": packages, "omittedOptionalPackages": omitted,
        "androidLibraries": android, "proprietaryDependencies": sources.get("proprietaryDependencies", []),
    }
    if unresolved:
        raise NoticeError("Full license material missing for shipped dependencies: " + ", ".join(unresolved))
    return inventory, material


def render(inventory: dict, material: dict) -> str:
    parts = [
        "ROAMY — Third-party notices\n",
        "These notices reproduce third-party license and attribution material. They do not apply a new license to ROAMY's own code.\n",
        f"Web scope: {inventory['shippedPackageCount']} packages identified as shipped; {inventory['runtimePackageCount']} installed non-dev lockfile entries inventoried.\n",
        "Unshipped installed dependencies remain in docs/licenses/runtime-dependencies.json. A passing material check is not legal certification or approval of proprietary SDK terms.\n",
    ]
    for package in inventory["packages"]:
        if not package["shipped"]:
            continue
        parts.extend(["\n" + "=" * 78 + "\n", f"{package['name']} {package['version']}\n", f"Lockfile path: {package['path']}\n",
                      f"Declared license metadata: {package['declaredLicense'] or 'not supplied'}\n"])
        for label, data in material[package["path"]]:
            parts.extend(["\n" + label + "\n", "-" * 78 + "\n", data.decode("utf-8"), "\n"])
    for library in inventory["androidLibraries"]:
        parts.extend(["\n" + "=" * 78 + "\n", f"Android: {library['name']}\n", f"Coordinates: {', '.join(library['coordinates'])}\n",
                      f"Declared license metadata: {library['declaredLicense']}\n"])
        for label, data in material[f"android:{library['name']}"]:
            parts.extend(["\n" + label + "\n", "-" * 78 + "\n", data.decode("utf-8"), "\n"])
    if inventory["proprietaryDependencies"]:
        parts.extend(["\n" + "=" * 78 + "\n", "Proprietary SDKs — separate terms\n"])
        for sdk in inventory["proprietaryDependencies"]:
            parts.extend([f"{sdk['name']}: {', '.join(sdk['coordinates'])}\n", sdk["notice"] + "\n", "Official terms/documentation: " + sdk["sourceUrl"] + "\n"])
    return "".join(parts).replace("\r\n", "\n").replace("\r", "\n")


def generate(root: Path, bundle_path: Path | None, check: bool = False):
    inventory, material = collect(root, bundle_path)
    outputs = {INVENTORY: json_text(inventory), NOTICES: render(inventory, material)}
    for relative, text in outputs.items():
        target = root / relative
        if check:
            if not target.is_file() or target.read_bytes() != text.encode("utf-8"):
                raise NoticeError(f"Generated attribution output is stale or altered: {relative}")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(text.encode("utf-8"))
    return inventory


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--bundle-inventory", type=Path, help="Exact emitted package inventory; otherwise conservatively include all installed runtime packages")
    parser.add_argument("--check", action="store_true", help="Read-only verification of sources, lock inventory and exact generated output")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    bundle_path = args.bundle_inventory
    if bundle_path is not None and not bundle_path.is_absolute():
        bundle_path = root / bundle_path
    try:
        inventory = generate(root, bundle_path, args.check)
    except (NoticeError, KeyError, TypeError) as error:
        print(f"Attribution check failed: {error}", file=sys.stderr)
        return 1
    print(f"{'Verified' if args.check else 'Generated'} notices for {inventory['shippedPackageCount']} shipped web packages ({inventory['runtimePackageCount']} installed runtime entries) and {len(inventory['androidLibraries'])} Android library groups.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
