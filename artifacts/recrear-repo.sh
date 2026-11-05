#!/usr/bin/env bash
# Recrea el repositorio de GitHub con la historia ya limpia.
# Uso: ./recrear-repo.sh <ruta-o-url-del-bundle> [usuario-github]
set -euo pipefail

BUNDLE="${1:?uso: ./recrear-repo.sh threekip-clean.bundle [usuario]}"
USUARIO="${2:-kipzitox}"
DESTINO="$(mktemp -d)/threekip"

echo ">> Clonando la historia limpia desde el bundle..."
git clone "$BUNDLE" "$DESTINO"
cd "$DESTINO"

echo ">> Comprobando la historia..."
echo "   commits: $(git rev-list --count HEAD) | autores distintos: $(git log --format='%an <%ae>' | sort -u | wc -l)"
git log --format='%an <%ae>' | sort -u

echo ">> Apuntando al repositorio nuevo (debe estar vacio)..."
git remote remove origin
git remote add origin "git@github.com:${USUARIO}/threekip.git"

echo ">> Subiendo main..."
git push -u origin main

echo ">> Hecho: https://github.com/${USUARIO}/threekip"
