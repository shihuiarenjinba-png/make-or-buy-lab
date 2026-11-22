from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"

SECRET_PATTERNS = {
    "Stripe secret key": re.compile(r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b"),
    "Stripe webhook secret": re.compile(r"\bwhsec_[A-Za-z0-9]{16,}\b"),
    "GitHub token": re.compile(r"\b(?:ghp_|github_pat_)[A-Za-z0-9_]{16,}\b"),
}
USES_RE = re.compile(r"^\s*-?\s*uses:\s*([^\s#]+)", re.MULTILINE)
FULL_SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def tracked_files() -> list[Path]:
    raw = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT)
    return [ROOT / p.decode("utf-8", "surrogateescape") for p in raw.split(b"\0") if p]


def main() -> int:
    errors: list[str] = []

    for path in tracked_files():
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                errors.append(f"{path.relative_to(ROOT)}: possible committed {label}")

    for path in WORKFLOWS.glob("*.y*ml"):
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(ROOT)
        if "\npermissions:" not in text:
            errors.append(f"{rel}: explicit permissions block required")
        if "pull_request_target:" in text:
            errors.append(f"{rel}: pull_request_target forbidden")
        if re.search(r"\bsecrets:\s*inherit\b", text):
            errors.append(f"{rel}: secrets: inherit forbidden")
        if "wrangler@latest" in text:
            errors.append(f"{rel}: wrangler@latest forbidden")

        for match in USES_RE.finditer(text):
            target = match.group(1)
            if target.startswith("./") or target.startswith("docker://"):
                continue
            if "@" not in target or not FULL_SHA_RE.fullmatch(target.rsplit("@", 1)[1]):
                errors.append(f"{rel}: action must use full 40-char SHA: {target}")

    if errors:
        print("SECURITY_GUARD_FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print("SECURITY_GUARD_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
