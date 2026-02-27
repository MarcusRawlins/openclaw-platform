#!/bin/bash
# Archive old memory files (older than 7 days) to the memory drive
# Run monthly or as needed

WORKSPACE_MEMORY="/Users/marcusrawlins/.openclaw/workspace/memory"
ARCHIVE_BASE="/Volumes/reeseai-memory/agents/marcus/memory-archive"
CURRENT_MONTH=$(date +%Y-%m)

mkdir -p "$ARCHIVE_BASE/$CURRENT_MONTH"

# Archive daily notes older than 7 days
find "$WORKSPACE_MEMORY" -name "2026-*.md" -mtime +7 -type f | while read f; do
    filename=$(basename "$f")
    cp "$f" "$ARCHIVE_BASE/$CURRENT_MONTH/$filename"
    if [ $? -eq 0 ]; then
        rm "$f"
        echo "Archived: $filename"
    fi
done

# Archive session context/state files older than 3 days
find "$WORKSPACE_MEMORY" -name "*session*.md" -mtime +3 -type f | while read f; do
    filename=$(basename "$f")
    cp "$f" "$ARCHIVE_BASE/$CURRENT_MONTH/$filename"
    if [ $? -eq 0 ]; then
        rm "$f"
        echo "Archived: $filename"
    fi
done

echo "Archive complete. Files moved to $ARCHIVE_BASE/$CURRENT_MONTH/"
