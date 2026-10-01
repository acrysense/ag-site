#!/usr/bin/env bash
# Демо на GitHub Pages: https://acrysense.github.io/ag-site/
# Выкладываются только перечисленные страницы — остальные по мере проверки:
#   npm run deploy:pages -- index search
# Сборка с BASE=/ag-site/ уходит в ветку gh-pages (рабочая ветка не переключается).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -eq 0 ]; then
	echo "Укажите страницы без .html: npm run deploy:pages -- index search"
	exit 1
fi

BASE=/ag-site/ npm run build

OUT=$(mktemp -d)
INDEX=$(mktemp -u)
trap 'rm -rf "$OUT" "$INDEX"' EXIT
cp -R dist/. "$OUT"/

# Страницы не из списка (и витрина dev-*) не выкладываются
for file in "$OUT"/*.html; do
	name=$(basename "$file" .html)
	keep=0
	for page in "$@"; do [ "$page" = "$name" ] && keep=1; done
	[ "$keep" = 1 ] || rm "$file"
done
touch "$OUT/.nojekyll"

# Коммит в gh-pages через отдельный индекс, поверх прошлой выкладки
git fetch -q origin gh-pages 2>/dev/null || true
export GIT_INDEX_FILE="$INDEX"
git --work-tree="$OUT" add -A
tree=$(git write-tree)
parent=$(git rev-parse -q --verify refs/remotes/origin/gh-pages || true)
commit=$(git commit-tree "$tree" ${parent:+-p "$parent"} -m "Демо: $*")
git push -q origin "$commit:refs/heads/gh-pages"
echo "Выложено: $* → https://acrysense.github.io/ag-site/"
