#!/usr/bin/env bash
# Демо на GitHub Pages: https://acrysense.github.io/ag-site/
# Выкладываются страницы из tools/published-pages.txt (тот же список — у natix):
#   npm run deploy:pages
# Сборка с BASE=/ag-site/ уходит в ветку gh-pages (рабочая ветка не переключается). Демо закрыто от
# поиска (noindex на страницах), превью ссылок в мессенджерах работают.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -gt 0 ]; then
	echo "Список страниц — в tools/published-pages.txt (общий с natix), аргументы не нужны: npm run deploy:pages"
	exit 1
fi
PAGES=$(bash tools/published-pages.sh | tr '\n' ' ')

BASE=/ag-site/ SITE_URL=https://acrysense.github.io/ag-site/ DEMO_NOINDEX=1 npm run build

OUT=$(mktemp -d)
INDEX=$(mktemp -u)
trap 'rm -rf "$OUT" "$INDEX"' EXIT
cp -R dist/. "$OUT"/

# Страницы не из списка — tools/hide-unpublished.mjs (и их истории в витрине). «Страницы вёрстки»
# (dev-pages) и витрина компонентов (dev-ui, dev-canvas) выкладываются всегда — только на демо:
# в сборку для Битрикса (--mode cms, natix) служебные страницы не попадают
node tools/hide-unpublished.mjs "$OUT"
touch "$OUT/.nojekyll"

# Коммит в gh-pages через отдельный индекс, поверх прошлой выкладки
git fetch -q origin gh-pages 2>/dev/null || true
export GIT_INDEX_FILE="$INDEX"
git --work-tree="$OUT" add -A
tree=$(git write-tree)
parent=$(git rev-parse -q --verify refs/remotes/origin/gh-pages || true)
commit=$(git commit-tree "$tree" ${parent:+-p "$parent"} -m "Демо: $PAGES")
git push -q origin "$commit:refs/heads/gh-pages"
echo "Выложено: $PAGES→ https://acrysense.github.io/ag-site/ (все страницы: https://acrysense.github.io/ag-site/dev-pages.html)"
