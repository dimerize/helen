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

## Step 4 — Create the Pages project

1. Cloudflare dashboard sidebar: **Compute (Workers & Pages)** → **Create** → **Pages** tab → **Connect to Git**
2. Click **Connect GitHub**, authorise it, and pick the **`helen`** repository.
3. On the setup screen enter exactly this:

| Field | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | `Astro` |
| Build command | `npm run build` |
| Build output directory | `dist` |

4. Expand **Environment variables** and add one:

| Name | Value |
| --- | --- |
| `NODE_VERSION` | `22` |

5. Click **Save and Deploy**.

Wait about a minute. When it finishes you get a live address like `helen-abc.pages.dev`. **Open it. The site is already live on the internet at this point.** The domain in the next step just gives it a nicer name.

---

## Step 5 — Attach the domain

1. In the Pages project: **Custom domains** tab → **Set up a custom domain**
2. Type the domain you bought, e.g. `helenzhang.studio`
3. Click **Continue** → **Activate domain**

Because you bought the domain at Cloudflare, the DNS record is created for you. Nothing to copy or paste.

Wait 1–5 minutes. Then open `https://helenzhang.studio`. The padlock is already there — the HTTPS certificate is issued and renewed automatically, forever, at no cost.

4. Repeat for `www.helenzhang.studio` if you want that to work too.

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

1. Put that image file into the `incoming/` folder in the project.
2. Run:

```bash
npm run adopt -- --og whatever-you-named-it.jpg
```

That crops it to 1200×630, which is the shape iMessage, Slack, Instagram and Twitter all expect, and writes it to the right place. Then commit and push.

3. Test it: send yourself the link in iMessage.

> **Previews get cached hard.** If you change the image later and the old one still shows, that is Apple's cache, not a bug. Adding `?2` to the end of the link when testing forces a fresh fetch.

---

## Adding Helen's artwork

1. Drop the photographs into the `incoming/` folder.
2. Run `npm run adopt`
3. Open each `src/content/works/*/index.md` and fill in the title, year, medium and the alt text.
4. `npm run verify` — this catches mistakes before they go anywhere.
5. `git add -A && git commit -m "Add work" && git push`

Full walkthrough in [CONTENT.md](CONTENT.md).

---

## If a deploy breaks

Nothing you push can take the site down. If a build fails, Cloudflare keeps serving the last good version and emails you.

To undo a bad deploy that did go out: Pages project → **Deployments** → find the last good one → **⋯** → **Rollback to this deployment**. It is instant.

---

## What you pay, ongoing

| | |
| --- | --- |
| Domain | ~$10–12/year |
| Hosting, bandwidth, HTTPS, deploys, rollbacks | $0 |

Cloudflare Pages' free tier has **unlimited bandwidth**, which is the reason it was chosen over Vercel or Netlify — both cap at 100 GB a month, and a portfolio full of video documentation can hit that.

There is no upgrade you will need.
