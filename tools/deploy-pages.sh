#!/usr/bin/env bash
# Демо на GitHub Pages: https://acrysense.github.io/ag-site/
# Выкладываются только перечисленные страницы — остальные по мере проверки:
#   npm run deploy:pages -- index search
# Сборка с BASE=/ag-site/ уходит в ветку gh-pages (рабочая ветка не переключается). Демо закрыто от
# поиска (noindex на страницах), превью ссылок в мессенджерах работают.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -eq 0 ]; then
	echo "Укажите страницы без .html: npm run deploy:pages -- index search"
	exit 1
fi

BASE=/ag-site/ SITE_URL=https://acrysense.github.io/ag-site/ DEMO_NOINDEX=1 npm run build

OUT=$(mktemp -d)
INDEX=$(mktemp -u)
trap 'rm -rf "$OUT" "$INDEX"' EXIT
cp -R dist/. "$OUT"/

# Страницы не из списка (и витрина dev-*) не выкладываются; «Страницы вёрстки» (dev-pages) —
# всегда, в её списке и в кнопке «Страницы» остаются только выложенные
for file in "$OUT"/*.html; do
	name=$(basename "$file" .html)
	keep=0
	[ "$name" = "dev-pages" ] && keep=1
	for page in "$@"; do [ "$page" = "$name" ] && keep=1; done
	[ "$keep" = 1 ] || rm "$file"
done
if [ -f "$OUT/dev-pages.json" ]; then
	node -e '
		const fs = require("fs"), file = process.argv[1], keep = new Set(process.argv.slice(2))
		const index = JSON.parse(fs.readFileSync(file, "utf8"))
		index.pages = index.pages.filter((page) => keep.has(page.name))
		index.showcaseUrl = null
		fs.writeFileSync(file, JSON.stringify(index))
	' "$OUT/dev-pages.json" "$@"
fi
touch "$OUT/.nojekyll"

# Коммит в gh-pages через отдельный индекс, поверх прошлой выкладки
git fetch -q origin gh-pages 2>/dev/null || true
export GIT_INDEX_FILE="$INDEX"
git --work-tree="$OUT" add -A
tree=$(git write-tree)
parent=$(git rev-parse -q --verify refs/remotes/origin/gh-pages || true)
commit=$(git commit-tree "$tree" ${parent:+-p "$parent"} -m "Демо: $*")
git push -q origin "$commit:refs/heads/gh-pages"
echo "Выложено: $* → https://acrysense.github.io/ag-site/ (все страницы: https://acrysense.github.io/ag-site/dev-pages.html)"
