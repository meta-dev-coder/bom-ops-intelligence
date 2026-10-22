# BOM Operations Intelligence on EC2

> **For Claude Code / AI assistants:**
> - **Ask the user before running any AWS command**, even read-only ones (`aws ec2 describe-*`, `aws ssm …`).
> - The host `i-02402cca42da52edd` (34.237.187.140) is **shared**: `aws-import` (gunicorn 5959, nginx 80/443,
>   Docker 8080) and acs-demo `live-dc` (8095, `/opt/live-dc`, `/etc/live-dc`). **Never touch those.**
>   This app lives only in `/opt/bom-ops`, `/etc/bom-ops`, user `bomops`, unit `bom-ops`, port **8096**.
> - `/etc/bom-ops/env` holds the password hash and provider keys: each key **once**; never print or commit it.

One Node process (`server.mjs`, systemd unit `bom-ops`) serves the built web app **and** the `/api` proxy, so
**Real mode works here** (unlike GitHub Pages, which is static). Plain HTTP on port 8096, behind a password
gate (`/login`; `/healthz` is open and returns only `{ok, version, startedAt}`). Port 8096 must be open only to
known IPs. The service uses its own Node at `/opt/bom-ops/bin/node`.

Because it is HTTP, the HTTPS GitHub Pages site cannot call it; Pages stays Simulation-only.

## 1. Build a release

Either push a tag (GitHub Actions builds and publishes it as a GitHub Release):
```bash
git tag ec2-$(date -u +%Y%m%d-%H%M) && git push origin --tags
```
or run the **EC2 release** workflow manually (Actions → EC2 release → Run workflow), or build locally with
`npm run release:ec2` (→ `releases/bom-ops-<tag>.tar.gz` + `.sha256`). The release contains the web bundle
(with the public ion token), the bundled server, the data files and these ops scripts — never server keys.

## 2. First install (on the instance, e.g. via SSM Session Manager)

```bash
TAG=$(curl -fsSL https://api.github.com/repos/meta-dev-coder/bom-ops-intelligence/releases/latest | grep -o '"tag_name": *"[^"]*"' | cut -d'"' -f4)
U=https://github.com/meta-dev-coder/bom-ops-intelligence/releases/download/$TAG
curl -fsSLO $U/bom-ops-$TAG.tar.gz && curl -fsSLO $U/bom-ops-$TAG.tar.gz.sha256
sha256sum -c bom-ops-$TAG.tar.gz.sha256
mkdir $TAG && tar -xzf bom-ops-$TAG.tar.gz -C $TAG && cd $TAG
sudo ./install.sh            # user bomops, own Node 22, /opt/bom-ops/current, /etc/bom-ops/env (kept if present), unit enabled
```

Set the password and keys, then start:
```bash
sudo -u bomops /opt/bom-ops/bin/node /opt/bom-ops/current/server.mjs --hash-password   # type twice, not echoed
sudo nano /etc/bom-ops/env      # BOM_DEMO_PASSWORD_HASH=scrypt$16384$8$1$...  + AERODATABOX_* / TOMTOM_API_KEY if you have them
sudo /opt/bom-ops/bomops.sh start
/opt/bom-ops/bomops.sh status
```
Without a password hash the service refuses to start (exit 2) unless `BOM_ALLOW_NO_PASSWORD=true`.

## 3. Security group

Open **TCP 8096 only to known IPs** (presenters' and viewers' public /32s), never `0.0.0.0/0`. Remove the rule
after the demo. Then open `http://34.237.187.140:8096/`.

## 4. Operate

```bash
sudo /opt/bom-ops/bomops.sh update latest     # or: update ec2-<tag>   (verifies sha256, switches atomically, keeps 3)
sudo /opt/bom-ops/bomops.sh rollback
/opt/bom-ops/bomops.sh status                 # unit, release, port, /healthz
/opt/bom-ops/bomops.sh logs                   # journalctl -u bom-ops -f
sudo /opt/bom-ops/bomops.sh restart | stop | start
sudo /opt/bom-ops/bomops.sh uninstall         # removes unit, /opt/bom-ops, /etc/bom-ops, user (asks first)
```
Changing `/etc/bom-ops/env` needs a restart; a restart signs everyone out. The unit is capped at
`MemoryMax=384M`, `CPUQuota=40%`.

## Real mode on this host

Sign in → Settings → role *Developer / Demo Operator* (or *System Administrator*) → **Real data**.
METAR weather and adsb.lol aircraft need no key. Flights need `AERODATABOX_*` and roads `TOMTOM_API_KEY` in
`/etc/bom-ops/env`. Outbound HTTPS to aviationweather.gov, api.adsb.lol and the provider APIs must be allowed.
