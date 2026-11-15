#!/usr/bin/env python3
"""Verify recorded design evidence without changing accepted media or notes.

The default command checks the committed MP4s and any hashed review frames in
an existing validation manifest. Raw WebM recordings are optional and are only
read with --compare-raw. Frame extraction is an explicit operation that writes
to a new directory; it never regenerates or rewrites an accepted manifest.
"""

import argparse
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys


class VerificationError(Exception):
    """An evidence file does not match the recorded validation contract."""


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--manifest", type=Path,
        default=Path(__file__).parent.parent / "artifacts/roamy-seoul/design/media-validation.json",
        help="existing validation JSON; media paths are relative to its directory",
    )
    parser.add_argument(
        "--duration-tolerance", type=float, default=0.01, metavar="SECONDS",
        help="allowed MP4 duration difference from the manifest (default: 0.01)",
    )
    parser.add_argument(
        "--compare-raw", action="store_true",
        help="also require and compare source WebM durations (not needed for committed evidence)",
    )
    parser.add_argument(
        "--raw-dir", type=Path,
        help="source WebM directory for --compare-raw (default: manifest directory)",
    )
    parser.add_argument(
        "--extract-frames", type=Path, metavar="NEW_DIRECTORY",
        help="after successful verification, extract declared review timestamps into a new directory",
    )
    return parser


def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def relative_file(base, value, label):
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise VerificationError(f"{label} must be a relative file path")
    path = (base / value).resolve()
    if not path.is_relative_to(base.resolve()):
        raise VerificationError(f"{label} must stay inside the evidence directory")
    return path


def positive_number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise VerificationError(f"{label} must be a positive finite number")
    return value


def positive_integer(value, label):
    if type(value) is not int or value <= 0:
        raise VerificationError(f"{label} must be a positive integer")
    return value


def rate(value, label):
    try:
        parsed = Fraction(str(value))
        if parsed <= 0:
            raise ValueError()
        return parsed
    except (ValueError, ZeroDivisionError):
        raise VerificationError(f"{label} must be a positive frame rate") from None


def run_tool(command, label, timeout=300):
    try:
        return subprocess.run(command, check=True, capture_output=True, text=True, timeout=timeout).stdout
    except FileNotFoundError:
        raise VerificationError(f"{command[0]} is required for media verification") from None
    except subprocess.TimeoutExpired:
        raise VerificationError(f"{label} exceeded the verification timeout") from None
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or "").strip().splitlines()
        suffix = f": {detail[-1][:300]}" if detail else ""
        raise VerificationError(f"{label} failed{suffix}") from None


def probe_media(path):
    raw = run_tool([
        "ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path),
    ], f"metadata probe for {path.name}", timeout=30)
    try:
        data = json.loads(raw)
        videos = [stream for stream in data["streams"] if stream.get("codec_type") == "video"]
        if len(videos) != 1:
            raise ValueError("expected one video stream")
        video = videos[0]
        duration = float(data["format"]["duration"])
        positive_number(duration, f"{path.name} probed duration")
        return {
            "codec": video["codec_name"],
            "width": video["width"], "height": video["height"],
            "frameRate": video["avg_frame_rate"], "durationSeconds": duration,
            "hasAudio": any(stream.get("codec_type") == "audio" for stream in data["streams"]),
        }
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        raise VerificationError(f"invalid metadata for {path.name}") from None


def decode_media(path):
    # Limit decoder, encoder and filter threading; no real output file is opened.
    run_tool([
        "ffmpeg", "-nostdin", "-hide_banner", "-v", "error", "-xerror",
        "-threads", "1", "-filter_threads", "1", "-filter_complex_threads", "1",
        "-i", str(path), "-map", "0:v:0", "-map", "0:a?",
        "-threads", "1", "-f", "null", "-",
    ], f"full decode for {path.name}")


def check_record(base, record):
    if not isinstance(record, dict):
        raise VerificationError("every video record must be an object")
    path = relative_file(base, record.get("file"), "video file")
    if path.suffix.lower() != ".mp4" or not path.is_file():
        raise VerificationError(f"missing MP4 video: {record.get('file')}")
    expected_hash = record.get("sha256")
    if not isinstance(expected_hash, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", expected_hash):
        raise VerificationError(f"{path.name} needs a recorded SHA-256 checksum")
    positive_integer(record.get("bytes"), f"{path.name} byte count")
    if path.stat().st_size != record["bytes"]:
        raise VerificationError(f"byte count mismatch for {path.name}")
    if file_hash(path) != expected_hash.lower():
        raise VerificationError(f"SHA-256 mismatch for {path.name}")
    for key in ["width", "height"]:
        positive_integer(record.get(key), f"{path.name} {key}")
    positive_number(record.get("durationSeconds"), f"{path.name} duration")
    if "rawDurationSeconds" in record:
        positive_number(record["rawDurationSeconds"], f"{path.name} recorded raw duration")
    rate(record.get("frameRate"), f"{path.name} frame rate")
    if not isinstance(record.get("codec"), str) or not record["codec"]:
        raise VerificationError(f"{path.name} needs a recorded codec")
    if type(record.get("hasAudio")) is not bool:
        raise VerificationError(f"{path.name} needs a recorded audio-presence boolean")
    frames = record.get("frames", [])
    if not isinstance(frames, list):
        raise VerificationError(f"{path.name} frames must be an array")
    for frame in frames:
        if not isinstance(frame, dict):
            raise VerificationError(f"{path.name} frame records must be objects")
        timestamp = frame.get("timestampSeconds")
        if (isinstance(timestamp, bool) or not isinstance(timestamp, (int, float)) or
                not math.isfinite(timestamp) or timestamp < 0 or timestamp >= record["durationSeconds"]):
            raise VerificationError(f"{path.name} has an invalid review-frame timestamp")
        frame_path = relative_file(base, frame.get("file"), "review frame")
        if "sha256" in frame:
            if not frame_path.is_file() or file_hash(frame_path) != frame["sha256"]:
                raise VerificationError(f"review-frame checksum mismatch for {frame_path.name}")
    return path


def verify_manifest(manifest_path, *, compare_raw=False, raw_dir=None, duration_tolerance=0.01):
    if not math.isfinite(duration_tolerance) or duration_tolerance < 0:
        raise VerificationError("duration tolerance must be finite and nonnegative")
    manifest_path = Path(manifest_path)
    base = manifest_path.parent
    try:
        manifest = json.loads(manifest_path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise VerificationError(f"cannot read validation manifest: {error}") from None
    records = manifest.get("videos") if isinstance(manifest, dict) else None
    if not isinstance(records, list) or not records:
        raise VerificationError("validation manifest needs a nonempty videos array")
    paths = [check_record(base, record) for record in records]
    if len(paths) != len(set(paths)):
        raise VerificationError("validation manifest contains duplicate video files")
    raw_paths = []
    if compare_raw:
        raw_base = Path(raw_dir) if raw_dir else base
        for record in records:
            source = relative_file(raw_base, str(Path(record["file"]).with_suffix(".webm")), "raw recording")
            if not source.is_file():
                raise VerificationError(f"missing raw WebM recording: {source.name}")
            raw_paths.append(source)
    result = []
    for index, (record, path) in enumerate(zip(records, paths)):
        actual = probe_media(path)
        for key in ["codec", "width", "height", "hasAudio"]:
            if actual[key] != record[key]:
                raise VerificationError(f"{key} mismatch for {path.name}")
        if rate(actual["frameRate"], f"{path.name} probed frame rate") != rate(record["frameRate"], path.name):
            raise VerificationError(f"frame rate mismatch for {path.name}")
        if abs(actual["durationSeconds"] - record["durationSeconds"]) > duration_tolerance:
            raise VerificationError(f"duration mismatch for {path.name}")
        item = {"file": record["file"], "bytes": record["bytes"], "sha256": record["sha256"], **actual}
        if compare_raw:
            raw_duration = probe_media(raw_paths[index])["durationSeconds"]
            if "rawDurationSeconds" in record and abs(raw_duration - record["rawDurationSeconds"]) > duration_tolerance:
                raise VerificationError(f"recorded raw duration mismatch for {path.name}")
            # A constant-frame-rate conversion can round by at most one output frame.
            difference = actual["durationSeconds"] - raw_duration
            if abs(difference) > float(1 / rate(actual["frameRate"], path.name)) + duration_tolerance:
                raise VerificationError(f"raw/MP4 duration difference exceeds one frame for {path.name}")
            item["rawDurationSeconds"] = raw_duration
            item["durationDifferenceSeconds"] = difference
        decode_media(path)
        item["fullDecode"] = "passed"
        result.append(item)
    return {"verification": "passed", "manifestUnchanged": True, "rawCompared": compare_raw, "videos": result}, manifest


def extract_frames(manifest_path, manifest, output_dir):
    """Extract only to a new directory, leaving original review files untouched."""
    output_dir = Path(output_dir)
    if output_dir.exists():
        raise VerificationError("frame extraction requires a new output directory")
    base = Path(manifest_path).parent
    targets = []
    for record in manifest["videos"]:
        video = relative_file(base, record["file"], "video file")
        for frame in record.get("frames", []):
            target = relative_file(output_dir, frame["file"], "extracted frame")
            targets.append((video, frame["timestampSeconds"], target))
    if len([target for _, _, target in targets]) != len({target for _, _, target in targets}):
        raise VerificationError("review frames have duplicate extraction paths")
    output_dir.mkdir(parents=True, exist_ok=False)
    for video, timestamp, target in targets:
        target.parent.mkdir(parents=True, exist_ok=True)
        run_tool([
            "ffmpeg", "-nostdin", "-hide_banner", "-v", "error", "-n", "-threads", "1",
            "-filter_threads", "1", "-filter_complex_threads", "1", "-ss", str(timestamp),
            "-i", str(video), "-frames:v", "1", "-threads", "1", str(target),
        ], f"frame extraction from {video.name}")
    return len(targets)


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.raw_dir and not args.compare_raw:
        parser.error("--raw-dir requires --compare-raw")
    try:
        report, manifest = verify_manifest(
            args.manifest, compare_raw=args.compare_raw, raw_dir=args.raw_dir,
            duration_tolerance=args.duration_tolerance,
        )
        if args.extract_frames:
            report["extractedFrameCount"] = extract_frames(args.manifest, manifest, args.extract_frames)
        print(json.dumps(report, indent=2))
        return 0
    except (VerificationError, OSError) as error:
        print(f"Media verification failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
