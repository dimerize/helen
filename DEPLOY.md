# Getting the site live

Follow these in order. Total time about 20 minutes, most of it waiting.
Total cost: the domain only, roughly **$10–12 for the year**. Nothing else charges you, ever.

You need: a GitHub account (you have one, `dimerize`) and a card.

---

## Step 1 — Put the code on GitHub

In Terminal, from the project folder:

```bash
cd /Users/wemby/Code/helen
git push -u origin build/stand-in
```

Then go to <https://github.com/dimerize/helen>, click the green **Compare & pull request** button, then **Merge pull request**.

Or skip the pull request and push straight to the main branch:

```bash
git checkout main
git merge build/stand-in
git push origin main
```

**Check:** refresh <https://github.com/dimerize/helen> and you should see all the files.

---

## Step 2 — Make a Cloudflare account

1. Go to <https://dash.cloudflare.com/sign-up>
2. Sign up with your email, verify it.
3. That's it. Do not add a site yet, do not pick a plan. Free is fine and stays fine.

---

## Step 3 — Buy the domain

1. In the Cloudflare dashboard left sidebar: **Domain Registration** → **Register Domains**
2. Search the name you want. Some to try:
   - `helenzhang.studio`
   - `helenzhang.art`
   - `helen-zhang.com`
   - `hzhang.studio`
3. Pick one, click **Purchase**, pay.

**Why buy it here and not GoDaddy/Namecheap:** Cloudflare sells domains at exactly what they cost them, with no markup and no renewal price jump, and privacy protection is included free. It also means the next step wires itself up automatically instead of you copying DNS records around.

**Expect:** `.com` about $10–12/year, `.studio` and `.art` about $20–30/year. It renews once a year at the same price.

---

## Step 4 — Create the Worker

Cloudflare now sends new Git imports into **Workers** rather than Pages. That is the right path to take — it is the one they are actively developing, and for a static site it behaves identically. Static asset requests on Workers are **free and unlimited**, same as Pages.

The repo already contains [`wrangler.jsonc`](wrangler.jsonc), which tells Cloudflare that `dist/` is the site. **That file must be pushed before you press Deploy**, or the build fails with nothing to deploy.

1. Cloudflare dashboard: **Compute (Workers & Pages)** → **Create** → **Import a repository**
2. Authorise GitHub, pick **`dimerize/helen`**
3. The form should read:

| Field | Value |
| --- | --- |
| Project name | `helen` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Builds for non-production branches | ticked |

4. Under **Advanced settings**, leave everything at its default:

| Field | Value |
| --- | --- |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Path | `/` |
| API token | leave on **Create new token** — it makes one for itself |

Node version is taken from [`.nvmrc`](.nvmrc), which is already set to 22. Nothing to add.

5. Click **Deploy**.

Wait about a minute. You get a live address like `helen.<your-subdomain>.workers.dev`. **Open it. The site is on the internet at this point.** The domain in the next step only gives it a better name.

---

## Step 5 — Attach the domain

1. In the Worker: **Settings** → **Domains & Routes** → **Add** → **Custom domain**
2. Enter `helenzhang.studio`, add it.
3. Add `www.helenzhang.studio` the same way if you want that to work too.

Because the domain was bought at Cloudflare, the DNS record is written for you. Nothing to copy or paste.

Wait 1–5 minutes, then open `https://helenzhang.studio`. The padlock is already there — the certificate is issued and renewed automatically, forever, free.

---

## Step 6 — Tell the code its own address

Two files have the address written in them, used for the sitemap and for link previews. Change both:

**`astro.config.mjs`**, near the top:
```js
export const SITE = 'https://helenzhang.studio';
```

**`public/robots.txt`**, last line:
```
Sitemap: https://helenzhang.studio/sitemap-index.xml
```

Then:
```bash
git add -A
git commit -m "Set production domain"
git push
```

Cloudflare sees the push and redeploys in about a minute. **You never have to run a deploy command. Pushing to GitHub is the deploy.**

---

## Step 7 — Turn on HTTPS everywhere

Cloudflare dashboard → pick your domain → **SSL/TLS** → **Edge Certificates** → switch on **Always Use HTTPS**.

This makes `http://` addresses redirect to `https://`. One click, done.

---

## The iMessage link preview

The picture that shows up when the address is texted comes from one file: `public/og-default.jpg`.

To make the red-and-white image the preview:

1. Replace `public/og-default.jpg` with a 1200×630 crop of the image you want.
2. Commit and push.
3. Test it: send yourself the link in iMessage.

> **Previews get cached hard.** If you change the image later and the old one still shows, that is Apple's cache, not a bug. Adding `?2` to the end of the link when testing forces a fresh fetch.

---

## Updating content later

1. Edit `src/content/site/about.md`, `src/data/site.ts` or `src/data/cv.ts`.
2. `npm run verify` — catches mistakes before they go anywhere.
3. `git add -A && git commit -m "Update content" && git push`


---

## If a deploy breaks

Nothing you push can take the site down. If a build fails, Cloudflare keeps serving the last good version and emails you.

To undo a bad deploy that did go out: the Worker → **Deployments** → find the last good one → **Rollback**. It is instant, and needs no rebuild.

---

## What you pay, ongoing

| | |
| --- | --- |
| Domain | ~$10–12/year |
| Hosting, bandwidth, HTTPS, deploys, rollbacks | $0 |

Requests to static assets on Cloudflare are **free and unlimited**, which is the reason it was chosen over Vercel or Netlify. Both of those cap at 100 GB a month, and a portfolio full of video documentation can reach that.

There is no upgrade you will need.
