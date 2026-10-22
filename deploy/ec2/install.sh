#!/usr/bin/env bash
# First install of bom-ops on a shared Ubuntu host. Touches ONLY /opt/bom-ops, /etc/bom-ops,
# the bomops user and the bom-ops systemd unit. Run from an unpacked release: sudo ./install.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(cat "$HERE/VERSION")"
NODE_VERSION="v22.23.2"

id bomops >/dev/null 2>&1 || useradd --system --home /opt/bom-ops --shell /usr/sbin/nologin bomops
mkdir -p /opt/bom-ops/releases /opt/bom-ops/bin /etc/bom-ops

# Own Node (system Node on this host is too old; never touch /usr/bin/node or /opt/live-dc).
if [ ! -x /opt/bom-ops/bin/node ]; then
  case "$(uname -m)" in x86_64) ARCH=x64 ;; aarch64) ARCH=arm64 ;; *) echo "unsupported arch"; exit 1 ;; esac
  TMP="$(mktemp -d)"
  NAME="node-$NODE_VERSION-linux-$ARCH"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/$NAME.tar.xz" -o "$TMP/$NAME.tar.xz"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  (cd "$TMP" && grep " $NAME.tar.xz\$" SHASUMS256.txt | sha256sum -c -)
  tar -xJf "$TMP/$NAME.tar.xz" -C /opt/bom-ops
  ln -sfn "/opt/bom-ops/$NAME/bin/node" /opt/bom-ops/bin/node
  rm -rf "$TMP"
fi

rm -rf "/opt/bom-ops/releases/$VERSION"
cp -a "$HERE" "/opt/bom-ops/releases/$VERSION"
ln -sfn "/opt/bom-ops/releases/$VERSION" /opt/bom-ops/current
install -m 755 "$HERE/bomops.sh" /opt/bom-ops/bomops.sh
chown -R root:root /opt/bom-ops

if [ ! -f /etc/bom-ops/env ]; then
  install -m 640 -o root -g bomops "$HERE/env.example" /etc/bom-ops/env
  echo "Created /etc/bom-ops/env — set BOM_DEMO_PASSWORD_HASH (and provider keys) before starting."
fi
install -m 644 "$HERE/bom-ops.service" /etc/systemd/system/bom-ops.service
systemctl daemon-reload
systemctl enable bom-ops >/dev/null
echo "Installed $VERSION. Next: set the password hash in /etc/bom-ops/env, then: sudo /opt/bom-ops/bomops.sh start"
