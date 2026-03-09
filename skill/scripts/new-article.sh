#!/usr/bin/env bash
# Scaffold a new wtf.fnord.lol deep-dive article
# Usage: new-article.sh <slug> <title>
set -euo pipefail

SLUG="${1:?Usage: new-article.sh <slug> \"Title\"}"
TITLE="${2:?Usage: new-article.sh <slug> \"Title\"}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="${WTF_REPO:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
DIR="$REPO/content/deep-dives/$SLUG"
DATE=$(date +%Y-%m-%d)

if [ -d "$DIR" ]; then
  echo "Error: $DIR already exists" >&2
  exit 1
fi

mkdir -p "$DIR"

cat > "$DIR/index.md" << FRONTMATTER
+++
title = "$TITLE"
description = ""
date = $DATE

[taxonomies]
tags = []
series = ["paper-deep-dives"]

[extra]
paper_url = ""
paper_date = ""
reading_time_original = ""
+++

## The One-Sentence Version



{% callout(type="tldr") %}
**What:**
**Why it matters:**
**The trick:**
{% end %}

## What Problem Are They Solving?



## The Architecture



## The Results



{% callout(type="insight") %}

{% end %}

## What's Actually New Here?

**Genuinely new:**
-

**Not new but well-executed:**
-

**The real contribution:**

{% callout(type="question") %}

{% end %}

## The Bigger Picture



## Bottom Line


FRONTMATTER

echo "Created $DIR/index.md"
echo "Next: edit the article, then run 'cd $REPO && zola check'"
