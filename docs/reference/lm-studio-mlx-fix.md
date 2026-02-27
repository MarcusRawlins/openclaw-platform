# LM Studio MLX Backend Fix

## Symptom
Error: `Failed to load LLM engine... dlopen... Library not loaded: @rpath/libpython3.11.dylib`

## Root Cause
LM Studio's MLX backend requires a bundled Python 3.11 at:
`~/.lmstudio/extensions/backends/vendor/_amphibian/cpython3.11-mac-arm64@10/`

This can get deleted by brew cleanup, disk cleanup tools, or LM Studio updates.

## Fix (30 seconds)

### Option A: Re-download via CLI
```bash
LMS="/Applications/LM Studio.app/Contents/Resources/app/.webpack/lms"
"$LMS" runtime get mlx
"$LMS" runtime select mlx-llm-mac-arm64-apple-metal-advsimd@1.3.0
killall "LM Studio" && sleep 3 && open -a "LM Studio"
```

### Option B: Restore from backup
```bash
cp -r /Volumes/reeseai-memory/backups/lmstudio/mlx-llm-mac-arm64-apple-metal-advsimd-1.3.0 ~/.lmstudio/extensions/backends/
cp -r /Volumes/reeseai-memory/backups/lmstudio/vendor ~/.lmstudio/extensions/backends/
killall "LM Studio" && sleep 3 && open -a "LM Studio"
```

## DO NOT do this
- Do NOT symlink brew's Python 3.11 (code signature mismatch, different Team IDs)
- Do NOT install GGUF versions (Tyler wants MLX for Apple Silicon optimization)

## Verification
```bash
curl -s http://127.0.0.1:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"mistralai/devstral-small-2-2512","messages":[{"role":"user","content":"hi"}],"max_tokens":5}'
```
Should return a chat completion, not an error.
