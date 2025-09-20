import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"


def get_remote_origin():
    try:
        url = subprocess.check_output([
            "git", "config", "--get", "remote.origin.url"
        ], cwd=str(ROOT), text=True).strip()
        return url or None
    except Exception:
        return None


def parse_owner_repo(remote_url: str):
    """Return (owner, repo) from a GitHub remote URL.
    Supports https and ssh forms. Returns None if not GitHub.
    """
    if not remote_url:
        return None
    # https form: https://github.com/owner/repo(.git)?
    m = re.match(r"^https?://github.com/([^/]+)/([^/]+?)(?:\.git)?$", remote_url)
    if m:
        return m.group(1), m.group(2)
    # ssh form: git@github.com:owner/repo.git
    m = re.match(r"^git@github.com:([^/]+)/([^/]+?)(?:\.git)?$", remote_url)
    if m:
        return m.group(1), m.group(2)
    return None


def update_readme(owner: str, repo: str) -> bool:
    if not README.exists():
        print("README.md not found; nothing to update.")
        return False
    content = README.read_text(encoding="utf-8")

    ci_badge_url = f"https://github.com/{owner}/{repo}/actions/workflows/ci.yml/badge.svg"
    ci_link_url = f"https://github.com/{owner}/{repo}/actions/workflows/ci.yml"

    changed = False

    # Replace placeholder OWNER/REPO if present
    new_content = content.replace(
        "https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg",
        ci_badge_url,
    )
    new_content = new_content.replace(
        "https://github.com/OWNER/REPO/actions/workflows/ci.yml",
        ci_link_url,
    )
    if new_content != content:
        content = new_content
        changed = True

    # If badge block missing entirely, inject under the first H1 if present, else prepend
    if "actions/workflows/ci.yml/badge.svg" not in content:
        badge_block = f"\n[![CI]({ci_badge_url})]({ci_link_url})\n"
        h1_match = re.search(r"^# .*$", content, flags=re.MULTILINE)
        if h1_match:
            # insert after the H1 line
            idx = h1_match.end()
            content = content[:idx] + badge_block + content[idx:]
        else:
            content = badge_block + content
        changed = True

    if changed:
        README.write_text(content, encoding="utf-8")
    return changed


def main():
    remote = get_remote_origin()
    parsed = parse_owner_repo(remote) if remote else None
    if not parsed:
        # Fallback to env vars if provided
        owner = os.getenv("REPO_OWNER")
        repo = os.getenv("REPO_NAME")
        if not owner or not repo:
            print("Could not detect GitHub remote. Set REPO_OWNER and REPO_NAME env vars or add a remote and re-run.")
            return 1
    else:
        owner, repo = parsed
    changed = update_readme(owner, repo)
    if changed:
        print(f"README badges updated for {owner}/{repo}.")
    else:
        print("README already up to date.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
