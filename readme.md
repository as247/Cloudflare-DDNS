# Cloudflare DDNS Worker

A lightweight Cloudflare Worker that updates DNS records through the Cloudflare API. It can be used from any system capable of making an HTTP request, including Synology DSM and simple shell scripts.

---

# 1. Worker

## Deploy

1. Log in to the Cloudflare Dashboard.
2. Go to **Workers & Pages**.
3. Create a new Worker.
4. Replace the default code with `worker.js`.
5. Deploy the Worker.

After deployment, note your Worker URL, for example:

```text
https://cloudflare-ddns.your-subdomain.workers.dev
```

This URL will be used by all clients.

---

## Create an API Token

1. Open **My Profile → API Tokens**.
2. Click **Create Token**.
3. Select the **Edit zone DNS** template.
4. Choose the DNS zone you want to manage.
5. Create the token and copy it.

The token requires only DNS edit permission for the selected zone.

---

## Get the Zone ID

1. Open your domain in Cloudflare.
2. Go to **Overview**.
3. Copy the **Zone ID** shown in the right sidebar.

---

# 2. Run using CLI

Edit the following script:

```bash
#!/usr/bin/env bash

# CHANGE THESE
authToken="YOUR_API_TOKEN"
zoneIdentifier="YOUR_ZONE_ID"
recordName="home.example.com"
ttl=120
proxied=false

workerURL="https://your-worker.workers.dev"

updateURL="${workerURL}/?user=${zoneIdentifier}&pass=${authToken}&host=${recordName}&ttl=${ttl}&proxied=${proxied}"

if command -v curl >/dev/null 2>&1; then
    curl -fsS --connect-timeout 10 --max-time 30 "$updateURL"
elif command -v wget >/dev/null 2>&1; then
    wget -qO- --timeout=30 "$updateURL"
else
    echo "Error: neither curl nor wget is installed." >&2
    exit 1
fi
```

Replace:

| Variable | Description |
|----------|-------------|
| `authToken` | Cloudflare API Token |
| `zoneIdentifier` | Cloudflare Zone ID |
| `recordName` | DNS record to update |
| `workerURL` | Your deployed Worker URL |
| `ttl` | DNS TTL |
| `proxied` | `true` to enable Cloudflare Proxy, otherwise `false` |

Run:

```bash
chmod +x update.sh
./update.sh
```

The Worker will automatically create the DNS record if it does not already exist.

---

# 3. Add to Synology

Open:

**Control Panel → External Access → DDNS**

Click **Customize Provider** and create a provider with:

**Service Provider**

```
Cloudflare
```

**Query URL**

```
https://your-worker.workers.dev/?user=__USERNAME__&pass=__PASSWORD__&host=__HOSTNAME__&ip=__MYIP__
```

Then add a new DDNS profile using this provider.

Fill in:

| Field | Value |
|-------|-------|
| Hostname | DNS record (e.g. `nas.example.com`) |
| Username / Email | Cloudflare Zone ID |
| Password / Key | Cloudflare API Token |

Click **Test Connection** and then **OK**.

From now on, Synology DSM will automatically update your Cloudflare DNS record whenever your public IP changes.