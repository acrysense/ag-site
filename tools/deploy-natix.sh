#!/usr/bin/env bash
# Деплой ag-site → natix (репозиторий клиента my.ag-html-v2, git.natix.ru). Нужен VPN.
#
#   tools/deploy-natix.sh --dry-run            собрать и показать разницу, ничего не отправлять
#   tools/deploy-natix.sh                      то же + спросить подтверждение и запушить
#   tools/deploy-natix.sh --yes -m "deploy: …" без вопроса (для неинтерактивного запуска)
#
# Как устроено (как в ag): natix подключён вторым remote, его ветка master выгружена в
# .deploy/natix (git worktree, игнорируется). Скрипт собирает проект под Bitrix
# (BASE=/bitrix/templates/ag-site/, --mode cms), раскладывает в worktree отслеживаемые
# файлы ag-site + dist + сгенерированные шрифты, удаляет устаревшее (старую gulp-сборку) и
# коммитит в natix поверх его истории — без force-push. В natix не уезжают служебные файлы
# (.github, .claude, настройки редактора, деплой-скрипты); .gitignore у natix свой, dist в нём
# игнорируется — добавляется принудительно. ag-site/dist после сборки возвращается как был.
set -euo pipefail

AG="$(cd "$(dirname "$0")/.." && pwd)"  # корень ag-site
WT="$AG/.deploy/natix"
STAGE="$AG/.deploy/stage"
DIST_BACKUP="$AG/.deploy/dist-backup"
NATIX_URL="https://git.natix.ru/silentcode/apteka-group/my.apteka-group.by/my.ag-html-v2.git"
NATIX_BRANCH="master"
BUILD_BASE="${BASE:-/bitrix/templates/ag-site/}"

DRY=0; YES=0; MSG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --yes) YES=1 ;;
    -m) MSG="${2:-}"; shift ;;
    *) echo "неизвестный аргумент: $1"; exit 2 ;;
  esac
  shift
done

say() { printf '\n== %s\n' "$*"; }
die() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

cd "$AG"

say "проверки"
[ "$(git branch --show-current)" = "main" ] || die "нужна ветка main"
git diff --quiet && git diff --cached --quiet || die "в ag-site есть незакоммиченные изменения"
git fetch -q origin
[ "$(git rev-parse main)" = "$(git rev-parse origin/main)" ] || die "main не совпадает с GitHub — сначала git push / git pull"
git remote get-url natix >/dev/null 2>&1 || git remote add natix "$NATIX_URL"
git fetch -q natix || die "natix недоступен (VPN включён?)"
if [ ! -e "$WT/.git" ]; then
  git worktree add -q -B natix-master "$WT" natix/$NATIX_BRANCH
  git -C "$WT" branch -q --set-upstream-to=natix/$NATIX_BRANCH natix-master
fi
git -C "$WT" reset -q --hard natix/$NATIX_BRANCH
git -C "$WT" clean -fdq
echo "ok: ag-site $(git rev-parse --short main), natix $(git -C "$WT" rev-parse --short HEAD)"

say "сборка под Bitrix"
rm -rf "$DIST_BACKUP"; mkdir -p "$DIST_BACKUP"
[ -d dist ] && rsync -a dist/ "$DIST_BACKUP/"
restore_dist() { rm -rf "$AG/dist"; mkdir -p "$AG/dist"; rsync -a "$DIST_BACKUP/" "$AG/dist/"; rm -rf "$DIST_BACKUP" "$STAGE"; }
trap restore_dist EXIT
BASE="$BUILD_BASE" npm run build -- --mode cms > "$AG/.deploy/build.log" 2>&1 \
  || { tail -30 "$AG/.deploy/build.log"; die "сборка упала (лог: .deploy/build.log)"; }
echo "ok: $(find dist -type f | wc -l | tr -d ' ') файлов"

say "раскладка в natix"
rm -rf "$STAGE"; mkdir -p "$STAGE"
git ls-files \
  | grep -vE '^(\.claude/|\.editorconfig$|\.github/|\.nvmrc$|\.prettierignore$|\.prettierrc$|\.gitignore$|dist/|tools/deploy-natix\.sh$|tools/deploy-pages\.sh$)' \
  | rsync -a --files-from=- "$AG/" "$STAGE/"
rsync -a dist/ "$STAGE/dist/"
mkdir -p "$STAGE/public/fonts" "$STAGE/app/assets/styles/base"
rsync -a public/fonts/ "$STAGE/public/fonts/"
cp app/assets/styles/base/_fonts.generated.scss "$STAGE/app/assets/styles/base/"
cp "$WT/.gitignore" "$STAGE/.gitignore"
find "$STAGE" -name .DS_Store -delete
rsync -a --delete --exclude .git "$STAGE/" "$WT/"
git -C "$WT" add -A
# dist у natix в .gitignore — сборку добавляем принудительно
git -C "$WT" add -f dist

if git -C "$WT" diff --cached --quiet; then
  say "изменений нет — natix уже актуален"
  exit 0
fi

say "что уедет в natix"
git -C "$WT" diff --cached --shortstat
git -C "$WT" diff --cached --name-status | awk '{print $1}' | sort | uniq -c | sed 's/^/  /'
echo "-- вне dist:"
git -C "$WT" diff --cached --name-status | grep -vE $'\tdist/' | sed 's/^/  /' || echo "  нет"

if [ "$DRY" = 1 ]; then
  git -C "$WT" reset -q --hard natix/$NATIX_BRANCH
  say "холостой прогон: ничего не отправлено"
  exit 0
fi

[ -n "$MSG" ] || MSG="deploy: $(git log -1 --format=%s main)"
if [ "$YES" != 1 ]; then
  printf '\nКоммит: %s\nОтправить в natix? [y/N] ' "$MSG"
  read -r answer </dev/tty || answer=""
  [ "$answer" = "y" ] || { git -C "$WT" reset -q --hard natix/$NATIX_BRANCH; die "отменено, natix не тронут"; }
fi

say "коммит и пуш"
git -C "$WT" commit -q -m "$MSG"
git -C "$WT" push -q natix "HEAD:$NATIX_BRANCH"
git fetch -q natix
[ "$(git -C "$WT" rev-parse HEAD)" = "$(git rev-parse natix/$NATIX_BRANCH)" ] || die "после пуша natix/$NATIX_BRANCH не совпадает — проверь вручную"
echo "ok: natix $NATIX_BRANCH → $(git rev-parse --short natix/$NATIX_BRANCH) ($(git -C "$WT" log -1 --format='%an <%ae>'))"
