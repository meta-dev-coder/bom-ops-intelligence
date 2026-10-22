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

## 1. Build and upload a release (like acs-demo `live-dc`)

```bash
npm run release:ec2      # → releases/bom-ops-<tag>.tar.gz + .sha256 + releases/latest; prints the 3 upload commands
```
Upload with the uploader IAM user (`arpana_thakur`, policy `live-dc-releases`); `latest` goes **last**:
```text
S3=s3://i595stackv5-i595corridordata41064a5b-oixfpv0dyrzj/releases/live-dc/bom-ops
aws s3 cp releases/bom-ops-<tag>.tar.gz        $S3/bom-ops-<tag>.tar.gz
aws s3 cp releases/bom-ops-<tag>.tar.gz.sha256 $S3/bom-ops-<tag>.tar.gz.sha256
aws s3 cp releases/latest                      $S3/latest --content-type text/plain --cache-control no-store
```
The prefix sits under `releases/live-dc/` on purpose: the existing uploader policy and the instance role
(`devteam_ssm_access`, inline policy `live-dc`) already allow it, so no IAM change is needed.
(GitHub Actions → **EC2 release** also publishes the same tarball as a GitHub Release.)

## 2. First install (on the instance, e.g. SSM Session Manager)

```bash
S3=s3://i595stackv5-i595corridordata41064a5b-oixfpv0dyrzj/releases/live-dc/bom-ops
V=$(aws s3 cp $S3/latest - | tr -d '[:space:]')
aws s3 cp $S3/bom-ops-$V.tar.gz . && aws s3 cp $S3/bom-ops-$V.tar.gz.sha256 .
sha256sum -c bom-ops-$V.tar.gz.sha256
mkdir $V && tar -xzf bom-ops-$V.tar.gz -C $V && cd $V
sudo ./install.sh            # user bomops, Node copied from /opt/live-dc/bin/node (or downloaded), /opt/bom-ops/current,
                             # /etc/bom-ops/env (kept if present; BOM_RELEASE_S3 preset), unit enabled (not started)
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
sudo /opt/bom-ops/bomops.sh update latest     # from $BOM_RELEASE_S3 (or GitHub if unset); verifies sha256, switches atomically, keeps 3
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
