#!/usr/bin/env sh
# Link Claude Code's per-project memory dir to this repo's committed memory.
#
# Claude Code stores project memory under ~/.claude/projects/<key>/memory,
# where <key> is the repo's absolute path with every "/" turned into "-".
# That key differs per machine, so run this once on each device after cloning
# to point Claude Code at the repo-tracked memory (which syncs via git).
set -e
repo="$(cd "$(dirname "$0")/.." && pwd)"
key="$(printf '%s' "$repo" | sed 's:/:-:g')"
dest="$HOME/.claude/projects/${key}/memory"

mkdir -p "$(dirname "$dest")"
if [ -L "$dest" ]; then
  ln -sfn "$repo/.claude/memory" "$dest"
elif [ -e "$dest" ]; then
  echo "Existing memory dir found; backing it up to ${dest}.bak"
  mv "$dest" "${dest}.bak"
  ln -s "$repo/.claude/memory" "$dest"
else
  ln -s "$repo/.claude/memory" "$dest"
fi
echo "Linked: $dest -> $repo/.claude/memory"
