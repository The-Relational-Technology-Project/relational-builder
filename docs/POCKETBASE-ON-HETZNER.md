# PocketBase on Hetzner — an EU backend for your community's tools

*November 2026. The first concrete step on gap 2 of `docs/REGIONAL-MODE.md`:
a shared backend that keeps neighbours' data in the EU, on a server the
community controls, with no US company in the chain. About twenty minutes
and about €4 a month. Written for the technical builder in a community; the
goal is that the next person after you doesn't need to be one.*

## What you end up with

One small server in Germany running [PocketBase](https://pocketbase.io): a
database, sign-in (email codes, no passwords for neighbours), file uploads
and realtime, all in a single program with a web admin panel. Your apps
talk to it over https at an address like `data.ourneighborhood.eu`. In the
Builder, you paste that address into **Services → PocketBase** once, and
every tool you build can share data through it.

Why this pairing: Hetzner (Gunzenhausen, Germany) owns its own data centres
in Falkenstein and Nuremberg and is one of the few EU-owned hosts at scale;
PocketBase is open source (MIT), runs on the smallest server Hetzner sells,
and its per-collection access rules are a security model a careful
non-expert can read. Scaleway (France) or OVH (France) work the same way if
you'd rather; only step 2 changes.

## Honest expectations

- One PocketBase server comfortably serves a neighbourhood, a district, a
  small city's worth of community tools. It is not a platform for millions.
- It is one machine. Set up backups (step 7) or accept that a disk failure
  loses the data. Hetzner's snapshots cost cents.
- Secret-key features (sending email through Brevo, AI through Mistral)
  need a few lines of server-side code. PocketBase runs JavaScript hooks for
  exactly that; the Builder writes them, you copy them into `pb_hooks/`.
  There is no automatic deploy for hooks yet (gap 3 in the regional-mode doc).
- You are now a person who runs a server. Updates are one command (step 8),
  but someone has to run it. Write down who.

## 1. A domain name

You need a hostname pointing at the server, because browsers won't let an
https app talk to a plain-http backend. A subdomain of something the
community already owns is ideal: `data.ourneighborhood.eu`. If you own
nothing yet, any registrar works; EU-based ones include Gandi (France),
INWX (Germany) and Infomaniak (Switzerland).

## 2. Create the server

1. Make an account at [hetzner.com/cloud](https://www.hetzner.com/cloud),
   then **New project**.
2. **Add server.** Location: **Falkenstein** or **Nuremberg**. Image:
   **Ubuntu 24.04**. Type: the smallest shared vCPU server (CX22 at the time
   of writing, 2 vCPU, 4 GB, about €4 a month). Networking: both IPv4 and
   IPv6.
3. **SSH key:** add yours. (On a Mac or Linux machine, `cat ~/.ssh/id_ed25519.pub`;
   if there isn't one, `ssh-keygen -t ed25519` first.)
4. **Cloud config:** paste the script below, replacing `data.ourneighborhood.eu`
   on the `DOMAIN=` line with your hostname. It installs PocketBase and Caddy
   (which handles https automatically), opens only the ports a web server
   needs, and starts everything.
5. **Firewall** (left menu, create one and apply it to the server): allow
   inbound TCP 22, 80 and 443; nothing else.
6. Create the server and copy its IPv4 address.

```yaml
#cloud-config
package_update: true
packages: [unzip, curl, ufw]
write_files:
  - path: /etc/systemd/system/pocketbase.service
    content: |
      [Unit]
      Description=PocketBase
      After=network.target
      [Service]
      User=pocketbase
      WorkingDirectory=/opt/pocketbase
      ExecStart=/opt/pocketbase/pocketbase serve --http=127.0.0.1:8090 --dir=/opt/pocketbase/pb_data --hooksDir=/opt/pocketbase/pb_hooks
      Restart=always
      RestartSec=5
      LimitNOFILE=4096
      [Install]
      WantedBy=multi-user.target
runcmd:
  - DOMAIN=data.ourneighborhood.eu
  # PocketBase: latest release, run as its own user
  - useradd --system --home /opt/pocketbase --shell /usr/sbin/nologin pocketbase
  - mkdir -p /opt/pocketbase/pb_data /opt/pocketbase/pb_hooks /opt/pocketbase/pb_migrations
  - URL=$(curl -s https://api.github.com/repos/pocketbase/pocketbase/releases/latest | grep browser_download_url | grep linux_amd64 | cut -d '"' -f 4)
  - curl -L "$URL" -o /tmp/pb.zip && unzip -o /tmp/pb.zip pocketbase -d /opt/pocketbase
  - chown -R pocketbase:pocketbase /opt/pocketbase
  - systemctl enable --now pocketbase
  # Caddy: https for the domain, proxied to PocketBase
  - apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  - curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  - curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  - apt-get update && apt-get install -y caddy
  - printf '%s {\n  reverse_proxy 127.0.0.1:8090\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile
  - systemctl restart caddy
  # Only ssh and web in
  - ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
```

## 3. Point the domain at it

At your registrar, add an **A** record for the hostname with the server's
IPv4 address, and an **AAAA** record with its IPv6 address if you have one.
Caddy requests a free certificate the first time the name resolves; give
DNS a few minutes.

Check: open `https://data.ourneighborhood.eu/api/health` in a browser. You
should see `{"code":200,"message":"API is healthy."...}`. If you see a
certificate error, DNS hasn't caught up yet; wait and reload.

## 4. Create the admin account

Open `https://data.ourneighborhood.eu/_/`. PocketBase 0.23 and newer shows
a one-time install link in the server log rather than an open sign-up
form; get it with

```sh
ssh root@<server-ip> journalctl -u pocketbase -n 50
```

or create the account directly:

```sh
ssh root@<server-ip> "cd /opt/pocketbase && sudo -u pocketbase ./pocketbase superuser upsert you@example.org 'a long passphrase'"
```

Use a passphrase you keep in a password manager. This account can read and
change everything.

## 5. Connect it in the Builder

Profile → **Where your tools live** → European Union (if you haven't
already). Then in a project: **Services → PocketBase**, paste
`https://data.ourneighborhood.eu`, **Connect**. The Builder checks the
server answers, then tells the model it's there.

## 6. Let the Builder design the data

Ask for what you want ("neighbours can list tools they'll lend, borrow
with a date, mark returned"). With PocketBase connected, the Builder writes
the app against it and produces a `pocketbase-schema.json` with the
collections and their access rules, plus a plain-language note at the top
saying who can read and write each one. Read that note; it is the whole
security model.

Import it once: admin panel → **Settings → Import collections** → paste →
Review → Confirm. Re-import when the Builder changes the schema.

Sign-in for neighbours is built in. The Builder uses PocketBase's
email-code flow, so nobody sets a password. For the emails to arrive, set
an SMTP sender in **Settings → Mail settings**; Brevo's free tier works and
is French (SMTP host `smtp-relay.brevo.com`, port 587, your Brevo login and
an SMTP key from SMTP & API → SMTP).

## 7. Backups

Admin panel → **Settings → Backups**. Turn on the schedule (daily is
fine). To keep copies off the machine, point it at S3-compatible storage:
Hetzner Object Storage (Falkenstein) or Scaleway Object Storage (Paris)
both work; create a bucket, make an access key, paste the endpoint, bucket,
region and keys. A Hetzner server **snapshot** (Cloud console → server →
Snapshots) every so often is a coarser second net.

## 8. Updating

PocketBase releases often. Updating is: download the new binary, replace
the old one, restart.

```sh
ssh root@<server-ip>
cd /opt/pocketbase && sudo -u pocketbase ./pocketbase update && systemctl restart pocketbase
```

Read the release notes for anything marked breaking before a major
version; the admin panel shows the running version in the bottom corner.

## 9. Secret-key features (email, AI, SMS)

When a tool needs to send email, call Mistral, or text someone, the key
must not be in the browser. Ask the Builder for the feature with PocketBase
connected; it writes a hook file such as `pb_hooks/send-digest.pb.js` that
reads the key from an environment variable and exposes a route the app
calls. Copy the file to `/opt/pocketbase/pb_hooks/`, put the key in the
service's environment (`systemctl edit pocketbase`, add
`Environment=BREVO_API_KEY=...`), restart. The Builder can't deploy this
for you yet; that's the next thing to build.

## When this isn't the right answer

- Nobody in the community wants to be the person with the ssh key. Then the
  answer is a shared EU backend run by a partner organisation (gap 2 in the
  regional-mode doc), which doesn't exist yet. Say so to us; demand is what
  makes it happen.
- The data is sensitive (health, legal status, minors). Talk to someone who
  does this for a living before trusting a weekend setup with it, EU or not.
- You need a real relational database for reporting. Supabase in an EU
  region, self-hosted or hosted, is the step up and connects the same way.
