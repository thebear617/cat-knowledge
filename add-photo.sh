#!/bin/bash
set -e

# _detect_pil_python: 找到一个能 import PIL 的 python 解释器，缓存到 _PYTHON_BIN
# 解决用户 shell alias 的 python3（装了 PIL）与 PATH 里的 python3（没装 PIL）不一致的问题
_PYTHON_BIN=""
_detect_pil_python() {
  if [ -n "$_PYTHON_BIN" ]; then echo "$_PYTHON_BIN"; return 0; fi
  for py in python3.10 python3.11 python3.12 python3.13 python3; do
    if command -v "$py" >/dev/null 2>&1; then
      if "$py" -c 'from PIL import Image' 2>/dev/null; then
        _PYTHON_BIN="$(command -v "$py")"
        echo "$_PYTHON_BIN"
        return 0
      fi
    fi
  done
  return 1
}

# process_image <src> <dst> <max_size>
# 用 sips 压缩图片（长边 ≤ max_size）。sips 失败时（如沙箱禁止写 /var/folders）回退到 Python PIL。
process_image() {
  local src="$1" dst="$2" max="$3"
  if sips -Z "$max" -s format jpeg "$src" --out "$dst" >/dev/null 2>&1; then
    return 0
  fi
  local py
  if ! py="$(_detect_pil_python)"; then
    echo "  ❌ sips 失败，且找不到安装了 Pillow 的 python。请 pip install Pillow。" >&2
    return 1
  fi
  echo "  ⚠️  sips 不可用，回退到 PIL ($py)..." >&2
  "$py" - "$src" "$dst" "$max" <<'PYEOF'
import sys
from PIL import Image
src, dst, max_size = sys.argv[1], sys.argv[2], int(sys.argv[3])
img = Image.open(src)
if img.mode != "RGB":
    img = img.convert("RGB")
img.thumbnail((max_size, max_size), Image.LANCZOS)
img.save(dst, "JPEG", quality=85, optimize=True)
PYEOF
}

if [ $# -lt 2 ]; then
  echo "用法: ./add-photo.sh <猫名> <照片路径> [照片路径...]"
  echo "示例: ./add-photo.sh 二柑 ~/Downloads/photo.jpg"
  exit 1
fi

CAT_NAME="$1"
shift

CATS_JS="js/cats.js"
IMAGES_DIR="images/${CAT_NAME}"
THUMB_DIR="${IMAGES_DIR}/thumb"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR"

mkdir -p "$IMAGES_DIR"
mkdir -p "$THUMB_DIR"

ADDED=()

for PHOTO in "$@"; do
  PHOTO="$(realpath "$PHOTO")"
  if [ ! -f "$PHOTO" ]; then
    echo "文件不存在: $PHOTO" >&2
    exit 1
  fi

  NEXT=$(ls "$IMAGES_DIR"/*.jpg 2>/dev/null | wc -l | tr -d ' ')
  NEXT=$((NEXT + 1))

  TARGET="${IMAGES_DIR}/${CAT_NAME}${NEXT}.jpg"
  process_image "$PHOTO" "$TARGET" 1200
  process_image "$TARGET" "${THUMB_DIR}/${CAT_NAME}${NEXT}.jpg" 400

  SIZE=$(du -h "$TARGET" | cut -f1)
  THUMB_SIZE=$(du -h "${THUMB_DIR}/${CAT_NAME}${NEXT}.jpg" | cut -f1)
  echo "  ${CAT_NAME}${NEXT}.jpg  原图 ${SIZE}  缩略图 ${THUMB_SIZE}"

  ADDED+=("${IMAGES_DIR}/${CAT_NAME}${NEXT}.jpg")
done

# Update cats.js
for IMG in "${ADDED[@]}"; do
  REL_PATH="$IMG"

  # Check if cat exists
  if ! grep -q "['\"]${CAT_NAME}['\"]" "$CATS_JS" 2>/dev/null; then
    echo "警告: 在 cats.js 中找不到 ${CAT_NAME}，请手动添加: $REL_PATH" >&2
    continue
  fi

  # Find the images line for this cat
  IMG_LINE=$(grep -n "['\"]${CAT_NAME}['\"]" "$CATS_JS" | head -1 | cut -d: -f1)
  IMAGES_LINE=$(tail -n +"$IMG_LINE" "$CATS_JS" | grep -n "images:" | head -1 | cut -d: -f1)
  LINE_NO=$((IMG_LINE + IMAGES_LINE - 1))

  CURRENT=$(sed -n "${LINE_NO}p" "$CATS_JS")

  if echo "$CURRENT" | grep -q 'images: \[\]'; then
    # First image: replace empty array
    sed -i '' "${LINE_NO}s|images: \[\]|images: ['$REL_PATH']|" "$CATS_JS"
    echo "  已添加: $REL_PATH"
  elif echo "$CURRENT" | grep -q 'images: \['; then
    # Already has images: append to array
    sed -i '' "${LINE_NO}s|images: \[|images: ['$REL_PATH', |" "$CATS_JS"
    echo "  已追加: $REL_PATH"
  else
    echo "警告: 无法解析 images 行，请手动添加: $REL_PATH" >&2
  fi
done

echo ""
echo "完成。提交并推送:"
echo "  git add . && git commit -m \"feat: add photos for ${CAT_NAME}\" && git push origin main"
