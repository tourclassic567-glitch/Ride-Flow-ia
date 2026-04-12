# 🌐 Domain Configuration – wolfida.com

This document describes the custom domain setup for the Ride-Flow IA project.

---

## Overview

| Field              | Value                                              |
|--------------------|----------------------------------------------------|
| **Domain**         | `wolfida.com`                                      |
| **DNS Provider**   | Namecheap                                          |
| **Hosting**        | Railway                                            |
| **Railway CNAME**  | `function-bun-production-0f84.up.railway.app`      |
| **Status**         | ✅ Configured                                       |

---

## DNS Records (Namecheap)

Configure the following records in **Namecheap → Domain List → wolfida.com → Advanced DNS → Host Records**:

| Type  | Host | Value                                            | TTL  |
|-------|------|--------------------------------------------------|------|
| CNAME | `@`  | `function-bun-production-0f84.up.railway.app`    | 3600 |
| CNAME | `www`| `function-bun-production-0f84.up.railway.app`    | 3600 |

> **Note:** Some DNS providers do not support CNAME on the root (`@`). If that is the case, use an **A record** pointing to the Railway IP address instead.

---

## Railway Setup

1. Go to [railway.app](https://railway.app) and open the **Ride-Flow-ia** project.
2. Select the backend service.
3. Navigate to **Settings → Domains → Add Custom Domain**.
4. Enter `wolfida.com` and confirm.
5. Railway will issue an SSL certificate automatically (may take a few minutes).

---

## Verification

After DNS propagates (5 – 30 minutes, up to 48 hours in rare cases), verify with:

```bash
# Check DNS resolution
nslookup wolfida.com
# or
dig wolfida.com

# Should resolve to the Railway CNAME or IP
```

Then open `https://wolfida.com` in your browser and confirm the app loads correctly.

---

## Troubleshooting

| Symptom                      | Possible Cause                          | Fix                                              |
|------------------------------|-----------------------------------------|--------------------------------------------------|
| Site not loading             | DNS not propagated yet                  | Wait up to 48 hours and try again                |
| SSL certificate error        | Certificate still provisioning          | Wait 5–10 minutes after DNS resolves             |
| `NXDOMAIN` in `nslookup`     | Wrong host value or typo in DNS record  | Double-check the CNAME value in Namecheap        |
| App loads but API fails      | `REACT_APP_API_URL` still points to localhost | Update frontend env vars to `https://wolfida.com` |

---

## Related Files

- `backend/railway.toml` — Railway service configuration
- `frontend/vercel.json` — Frontend routing (Vercel)
- `frontend/.env.example` — Frontend environment variables
