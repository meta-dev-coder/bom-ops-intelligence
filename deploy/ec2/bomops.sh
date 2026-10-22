#!/usr/bin/env bash
# Operate bom-ops. Releases come from GitHub Releases of the public repo (no AWS credentials needed).
#   bomops.sh update [latest|<tag>]   download, verify sha256, switch atomically, restart (keeps 3)
#   bomops.sh rollback | status | logs | start | stop | restart | uninstall [-y]
set -euo pipefail
REPO="meta-dev-coder/bom-ops-intelligence"
BASE=/opt/bom-ops
PORT="$(grep -E '^BOM_HTTP_PORT=' /etc/bom-ops/env 2>/dev/null | tail -1 | cut -d= -f2)"; PORT="${PORT:-8096}"
need_root() { [ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }; }

case "${1:-status}" in
  update)
    need_root
    TAG="${2:-latest}"
    if [ "$TAG" = latest ]; then
      TAG="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | "$BASE/bin/node" -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).tag_name))')"
    fi
    TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
    URL="https://github.com/$REPO/releases/download/$TAG"
    curl -fsSL "$URL/bom-ops-$TAG.tar.gz" -o "$TMP/r.tar.gz"
    curl -fsSL "$URL/bom-ops-$TAG.tar.gz.sha256" -o "$TMP/r.sha256"
    [ "$(sha256sum "$TMP/r.tar.gz" | cut -d' ' -f1)" = "$(cut -d' ' -f1 "$TMP/r.sha256")" ] || { echo "checksum mismatch"; exit 1; }
    mkdir -p "$BASE/releases/$TAG.new" && tar -xzf "$TMP/r.tar.gz" -C "$BASE/releases/$TAG.new"
    rm -rf "$BASE/releases/$TAG" && mv "$BASE/releases/$TAG.new" "$BASE/releases/$TAG"
    readlink "$BASE/current" > "$BASE/previous" 2>/dev/null || true
    ln -sfn "$BASE/releases/$TAG" "$BASE/current.tmp" && mv -T "$BASE/current.tmp" "$BASE/current"
    install -m 644 "$BASE/current/bom-ops.service" /etc/systemd/system/bom-ops.service
    install -m 755 "$BASE/current/bomops.sh" "$BASE/bomops.sh"
    systemctl daemon-reload && systemctl restart bom-ops
    ls -1dt "$BASE"/releases/*/ | tail -n +4 | xargs -r rm -rf
    echo "Now running $TAG"
    ;;
  rollback)
    need_root
    PREV="$(cat "$BASE/previous" 2>/dev/null || true)"; [ -n "$PREV" ] && [ -d "$PREV" ] || { echo "no previous release"; exit 1; }
    readlink "$BASE/current" > "$BASE/previous"
    ln -sfn "$PREV" "$BASE/current.tmp" && mv -T "$BASE/current.tmp" "$BASE/current"
    systemctl restart bom-ops; echo "Rolled back to $(basename "$PREV")"
    ;;
  status)
    systemctl --no-pager status bom-ops | head -5 || true
    echo "release: $(basename "$(readlink "$BASE/current" 2>/dev/null || echo none)")"
    (ss -ltn "sport = :$PORT" | grep -q LISTEN && echo "port $PORT: listening") || echo "port $PORT: NOT listening"
    curl -fsS "http://127.0.0.1:$PORT/healthz" && echo || echo "healthz: no answer"
    ;;
  logs) journalctl -u bom-ops -f ;;
  start|stop|restart) need_root; systemctl "$1" bom-ops ;;
  uninstall)
    need_root
    [ "${2:-}" = -y ] || { read -r -p "Remove bom-ops (unit, /opt/bom-ops, /etc/bom-ops, user)? [y/N] " a; [ "$a" = y ]; }
    systemctl disable --now bom-ops 2>/dev/null || true
    rm -f /etc/systemd/system/bom-ops.service && systemctl daemon-reload
    rm -rf /opt/bom-ops /etc/bom-ops; userdel bomops 2>/dev/null || true
    echo "Removed. Also close port $PORT in the security group."
    ;;
  *) echo "usage: $0 update [latest|<tag>] | rollback | status | logs | start | stop | restart | uninstall [-y]"; exit 1 ;;
esac
