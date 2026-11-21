#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: scripts/verify/publish-screenshots.sh [--dry-run] <folder> <label> [label...]" >&2
  echo "Pushes artifacts/verify/<label>/<platform>/*.png to the pr-screenshots branch under <folder>/ and prints a markdown table." >&2
  echo "--dry-run builds the commit locally and prints what it would push, without pushing." >&2
  exit 2
}

push=yes
if [[ "${1:-}" == "--dry-run" ]]; then
  push=no
  shift
fi
[[ $# -ge 2 ]] || usage
folder="$1"
shift
labels=("$@")
[[ "$folder" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "folder may only use letters, digits, dot, dash and underscore" >&2; exit 2; }

root="$(git rev-parse --show-toplevel)"
branch=pr-screenshots
remote="${VERIFY_SCREENSHOTS_REMOTE:-origin}"
repo="${VERIFY_SCREENSHOTS_REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || git remote get-url "$remote" | sed -E 's#^.*github\.com[:/]##; s#\.git$##')}"
raw="https://raw.githubusercontent.com/$repo/$branch/$folder"

git -C "$root" fetch --quiet "$remote" "+refs/heads/$branch:refs/remotes/$remote/$branch"
parent="$(git -C "$root" rev-parse "refs/remotes/$remote/$branch")"

scratch="$(mktemp -d "${TMPDIR:-/tmp}/publish-screenshots.XXXXXX")"
trap 'rm -rf "$scratch"' EXIT INT TERM
export GIT_INDEX_FILE="$scratch/index"
git -C "$root" read-tree "$parent"

platforms=()
screens=()
added=0
for label in "${labels[@]}"; do
  [[ -d "$root/artifacts/verify/$label" ]] || { echo "no screenshots for label $label in artifacts/verify/$label" >&2; exit 1; }
  for dir in "$root/artifacts/verify/$label"/*/; do
    platform="$(basename "$dir")"
    [[ "$platform" == logs ]] && continue
    for png in "$dir"*.png; do
      [[ -e "$png" ]] || continue
      screen="$(basename "$png" .png)"
      blob="$(git -C "$root" hash-object -w "$png")"
      git -C "$root" update-index --add --cacheinfo "100644,$blob,$folder/$platform-$label-$screen.png"
      echo "  + $folder/$platform-$label-$screen.png" >&2
      added=$((added + 1))
      [[ " ${platforms[*]-} " == *" $platform "* ]] || platforms+=("$platform")
      [[ " ${screens[*]-} " == *" $screen "* ]] || screens+=("$screen")
    done
  done
done
[[ $added -gt 0 ]] || { echo "no screenshots found for ${labels[*]}" >&2; exit 1; }

tree="$(git -C "$root" write-tree)"
if [[ "$tree" == "$(git -C "$root" rev-parse "$parent^{tree}")" ]]; then
  echo "pr-screenshots already has these exact files" >&2
  commit="$parent"
else
  commit="$(git -C "$root" commit-tree "$tree" -p "$parent" -m "Screenshots for $folder")"
fi

if [[ "$push" == yes && "$commit" != "$parent" ]]; then
  git -C "$root" push "$remote" "$commit:refs/heads/$branch"
elif [[ "$push" == no ]]; then
  echo "dry run: would push $commit (parent $parent) to $remote $branch with $added file(s); rerun without --dry-run to publish" >&2
fi

IFS=$'\n' sorted_screens=($(printf '%s\n' "${screens[@]}" | sort))
unset IFS
for platform in "${platforms[@]}"; do
  echo
  echo "**$platform**"
  echo
  header="| Screen |"
  rule="| --- |"
  for label in "${labels[@]}"; do
    header="$header $label |"
    rule="$rule --- |"
  done
  echo "$header"
  echo "$rule"
  for screen in "${sorted_screens[@]}"; do
    row="| $screen |"
    for label in "${labels[@]}"; do
      if [[ -e "$root/artifacts/verify/$label/$platform/$screen.png" ]]; then
        row="$row <img src=\"$raw/$platform-$label-$screen.png\" width=\"240\"> |"
      else
        row="$row |"
      fi
    done
    echo "$row"
  done
done
