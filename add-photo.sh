#!/bin/bash
set -e

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
  sips -Z 1200 -s format jpeg "$PHOTO" --out "$TARGET" > /dev/null 2>&1

  sips -Z 400 -s format jpeg "$TARGET" --out "${THUMB_DIR}/${CAT_NAME}${NEXT}.jpg" > /dev/null 2>&1

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
