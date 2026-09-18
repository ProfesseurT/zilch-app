#!/usr/bin/env bash
#
# ZILCH — envoi sur GitHub depuis un terminal macOS ou Linux.
#
# Equivalent de pousser.bat, avec trois choses que la version Windows n'a pas :
#
#   1. Il REFUSE de pousser si VERSION du service worker n'a pas bouge alors
#      qu'un fichier servi hors ligne a change. C'est la seule panne silencieuse
#      du projet : sans ce numero, l'iPhone sert l'ancienne version pour
#      toujours et rien ne le signale. Aucun test ne peut verifier ca — un test
#      ne voit pas l'historique git.
#   2. Il tire avant de pousser. Avec deux machines, sans ca le push est rejete.
#   3. Il demande le message de commit au lieu de l'ecrire en dur.
#
# Usage :
#     ./pousser.sh                  demande le message
#     ./pousser.sh "Mon message"    message donne directement
#
# Premiere fois :  chmod +x pousser.sh

set -u

cd "$(dirname "$0")" || exit 1

gras=$'\033[1m'; rouge=$'\033[31m'; vert=$'\033[32m'; jaune=$'\033[33m'; fin=$'\033[0m'
titre() { printf '\n%s== %s ==%s\n' "$gras" "$1" "$fin"; }
echec() { printf '\n%s[ARRET]%s %s\n\n' "$rouge" "$fin" "$1"; exit 1; }
ok()    { printf '%s%s%s\n' "$vert" "$1" "$fin"; }
alerte(){ printf '%s%s%s\n' "$jaune" "$1" "$fin"; }

# --- 0. Verifications de base -----------------------------------------------

command -v git >/dev/null 2>&1 || echec "git n'est pas installe sur cette machine."
git rev-parse --git-dir >/dev/null 2>&1 || echec "Ce dossier n'est pas un depot git."
[ -f service-worker.js ] || echec "service-worker.js est introuvable : mauvais dossier ?"

BRANCHE=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCHE" = "main" ] || alerte "Attention : tu es sur la branche '$BRANCHE', pas 'main'."

# --- 1. Y a-t-il quelque chose a envoyer ? ----------------------------------

titre "Fichiers modifies"
git status --short
if [ -z "$(git status --porcelain)" ]; then
  # Rien en local, mais il peut rester des commits non pousses.
  git fetch --quiet origin "$BRANCHE" 2>/dev/null || true
  if [ -z "$(git log --oneline "origin/$BRANCHE..HEAD" 2>/dev/null)" ]; then
    ok "Rien a envoyer : tout est deja sur GitHub."
    exit 0
  fi
  echo "(rien de nouveau en local, mais des commits attendent d'etre pousses)"
fi

git fetch --quiet origin "$BRANCHE" 2>/dev/null \
  || alerte "Impossible de joindre GitHub — la verification de version sera partielle."

# --- 2. LE controle qui compte : VERSION a-t-elle bouge ? -------------------
#
# On ne l'exige que si un fichier REELLEMENT servi hors ligne a change. Une
# modification qui ne touche que docs/ ou tests/ n'atteint jamais l'iPhone et
# n'a donc pas besoin d'un nouveau cache.

titre "Version du cache"

version_locale=$(sed -n "s/^const VERSION = '\([^']*\)'.*/\1/p" service-worker.js | head -1)
[ -n "$version_locale" ] || echec "Aucune constante VERSION lisible dans service-worker.js."

version_distante=$(git show "origin/$BRANCHE:service-worker.js" 2>/dev/null \
  | sed -n "s/^const VERSION = '\([^']*\)'.*/\1/p" | head -1)

# Tout ce qui differe de GitHub : deja commite, en attente, ou pas encore suivi.
modifies=$( { git diff --name-only "origin/$BRANCHE" 2>/dev/null;
              git ls-files --others --exclude-standard; } | sort -u )

servis=$(printf '%s\n' "$modifies" | grep -E '^(index\.html|manifest\.json|service-worker\.js|js/|css/|sons/|icon-)' || true)

if [ -z "$servis" ]; then
  ok "Rien qui parte sur l'iPhone (docs ou tests seulement) — pas de nouveau cache necessaire."
elif [ -z "$version_distante" ]; then
  alerte "Version distante illisible. Verifie toi-meme : locale = $version_locale"
elif [ "$version_locale" != "$version_distante" ]; then
  ok "$version_distante  ->  $version_locale"
else
  printf '\n%s[BLOQUE]%s VERSION est restee a %s%s%s alors que ces fichiers changent :\n\n' \
    "$rouge" "$fin" "$gras" "$version_locale" "$fin"
  printf '%s\n' "$servis" | sed 's/^/    /'
  printf '\nSans nouveau numero, le correctif n%satteindra JAMAIS ton iPhone,\n' "'"
  printf 'et rien ne te le signalera.\n\n'

  # Proposition d'incrementation, seulement si le format est 'zilch-vN'.
  suivant=""
  case "$version_locale" in
    zilch-v[0-9]*) suivant="zilch-v$(( ${version_locale#zilch-v} + 1 ))" ;;
  esac

  if [ -n "$suivant" ]; then
    printf 'Passer en %s%s%s maintenant ? [o/N] ' "$gras" "$suivant" "$fin"
    read -r rep
    case "$rep" in
      o|O|oui|Oui)
        # -i.bak : la seule forme acceptee a la fois par macOS et Linux.
        sed -i.bak "s/^const VERSION = '$version_locale'/const VERSION = '$suivant'/" service-worker.js
        rm -f service-worker.js.bak
        ok "service-worker.js passe en $suivant"
        ;;
      *) echec "Rien n'a ete envoye. Incremente VERSION en tete de service-worker.js." ;;
    esac
  else
    echec "Rien n'a ete envoye. Incremente VERSION en tete de service-worker.js."
  fi
fi

# --- 3. Tests ----------------------------------------------------------------

if command -v npm >/dev/null 2>&1; then
  titre "Tests"
  npm test || echec "Des tests echouent. RIEN n'a ete envoye."
else
  alerte "Node absent : tests ignores. Tu pousses sans filet."
fi

# --- 4. Message de commit ----------------------------------------------------

message="${1:-}"
if [ -z "$message" ]; then
  titre "Message de commit"
  printf 'Decris ce que tu as change (Entree = "Mise a jour") : '
  read -r message
fi
[ -n "$message" ] || message="Mise a jour"

# --- 5. Commit, puis tirer, puis pousser -------------------------------------

titre "Envoi"

git add -A || echec "git add a echoue."

if [ -n "$(git diff --cached --name-only)" ]; then
  git commit -m "$message" || echec "Le commit a echoue.
  Si git demande qui tu es :
      git config --global user.name  \"Ted\"
      git config --global user.email \"teddypereira88@gmail.com\""
fi

# Tirer AVANT de pousser. Sans ca, deux machines suffisent a bloquer l'envoi.
if ! git pull --rebase origin "$BRANCHE"; then
  git rebase --abort 2>/dev/null
  echec "GitHub contient des modifications qui entrent en conflit avec les tiennes.
  Rien n'a ete envoye, rien n'a ete casse.
  Ouvre GitHub Desktop pour voir les deux versions, ou demande de l'aide."
fi

git push origin "$BRANCHE" || echec "L'envoi a echoue.
  Cause la plus frequente : identifiants GitHub absents sur cette machine.
      git config --global credential.helper osxkeychain   (macOS)
      git config --global credential.helper store         (Linux)"

version_finale=$(sed -n "s/^const VERSION = '\([^']*\)'.*/\1/p" service-worker.js | head -1)

printf '\n%s==========================================%s\n' "$vert" "$fin"
ok "  ENVOYE."
printf '\n  L%sapplication se met a jour sur ton iPhone\n' "'"
printf '  dans la minute : le cache passe en %s%s%s.\n' "$gras" "$version_finale" "$fin"
printf '\n  https://professeurt.github.io/zilch-app/\n'
printf '%s==========================================%s\n\n' "$vert" "$fin"
