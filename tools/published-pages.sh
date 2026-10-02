#!/usr/bin/env bash
# Список страниц из tools/published-pages.txt (без комментариев и пустых строк), по одной в строке.
# Используют deploy-pages.sh и deploy-natix.sh.
sed -e 's/#.*//' -e 's/[[:space:]]//g' "$(dirname "$0")/published-pages.txt" | grep -v '^$'
