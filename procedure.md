# Matchify — Step-by-step Development & Deployment Plan

> **Project:** Matchify — compare your Spotify music taste to other users and produce compatibility metrics.

---

## Overview

Matchify is a lightweight, no-ML web app that compares a signed-in user's Spotify data with *your* Spotify profile (the owner profile) and computes three metrics:

1. **Compatibility score** (0–100)
2. **Top matching genre(s)**
3. **Top matching songs**

We will use:

* Frontend: **React** (JSX) + **Framer Motion** for animations
* Backend: simple **Vercel Serverless Functions** (Node.js) to handle Spotify OAuth and token refresh and to talk to **Supabase** (free tier) for storing refresh tokens and aggregated music data
* Database: **Supabase Postgres** (store user metadata, refresh tokens, cached music taste snapshots)
* Deployment: **Vercel** for frontend + serverless endpoints. Deploy the site early to obtain a Spotify callback URL.

**Constraints & choices**

* No machine learning. Matching is deterministic and interpretable.
* Keep the stack free where possible (Supabase free tier + Vercel hobby plan free tier). Do **not** use Supabase Edge Functions (per your earlier requirement).
* Update the owner profile's cached music taste **twice daily** using a scheduled job (we provide GitHub Actions cron or Vercel cron alternatives).

---

## High-level flow

1. You (owner) connect your Spotify account to the backend (one-time OAuth) — backend stores a **refresh token** in Supabase and periodically refreshes your access token and pulls your data.
2. Deploy frontend to Vercel (before algorithm) so you can register the deployed callback URL in Spotify Developer Dashboard.
3. Site visitors log in with their Spotify via OAuth on the site; after OAuth the frontend calls a Vercel serverless endpoint which stores their refresh token (optional) or fetches an access token to immediately fetch and cache their music taste.
4. When a user is ready to compare, the backend fetches the cached owner snapshot and the visitor's snapshot and computes the three metrics using a deterministic algorithm.
5. The frontend displays results (score, matching genres, matching songs) with Framer Motion animations and Spotify-inspired styling.

---

## Spotify app setup (developer.spotify.com)

1. Create a Spotify Developer App.
2. Add a Redirect URI equal to the deployed Vercel frontend callback URL + path, e.g.: `https://your-matchify.vercel.app/api/spotify/callback` (we'll use that path in examples). Deploy to Vercel first to get the exact domain.
3. Note **Client ID** and **Client Secret**. Add these to Vercel environment variables (see section on env variables).
4. Required scopes (minimal):

   * `user-read-private` (optional)
   * `user-library-read` (liked songs)
   * `user-read-recently-played`
   * `playlist-read-private` (access to playlists)
   * `user-top-read` (top artists and tracks)

> Only request scopes you need. Requesting fewer scopes improves conversion.

---

## Database schema (Supabase Postgres)

Suggested tables (SQL-ish):

```sql
-- users: stores visitor + owner profile metadata
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id text UNIQUE NOT NULL,
  display_name text,
  is_owner boolean DEFAULT false,
  last_snapshot_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- tokens: store refresh tokens (encrypted) and metadata
CREATE TABLE tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  token_type text,
  created_at timestamptz DEFAULT now()
);

-- snapshots: cached taste data fetched from Spotify (jsonb)
CREATE TABLE snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  snapshot_type text, -- 'owner' | 'visitor' | 'manual'
  fetched_at timestamptz DEFAULT now()
);

-- optional: matches log
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id),
  visitor_id uuid REFERENCES users(id),
  result jsonb,
  created_at timestamptz DEFAULT now()
);
```

**Snapshot JSON shape (recommended)**

```json
{
  "top_tracks": ["spotify:track:...", ...],
  "liked_tracks": ["spotify:track:...", ...],
  "recently_played": ["spotify:track:...", ...],
  "playlists_tracks": ["spotify:track:...", ...],
  "top_artists": ["spotify:artist:...", ...],
  "genres": {"pop": 12, "indie": 5, ...},
  "fetched_at": "2025-12-09T...Z"
}
```

Notes:

* Keep track of track IDs and artist IDs rather than full metadata in snapshots to reduce storage. Fetch names/cover art on-demand from Spotify when rendering.
* Store aggregated `genres` as frequency counts derived from top artists' genres.

---

## Backend endpoints (Vercel serverless functions)

Place these under `api/spotify/*` (Node + Express-like or vanilla handlers). Example endpoints:

1. `GET /api/spotify/login?returnTo=/compare` — redirects user to Spotify OAuth (authorization URL) with `state` and `returnTo` param.
2. `GET /api/spotify/callback` — Spotify redirects here with `code`. Exchange `code` for `access_token` + `refresh_token`. Create or update user in Supabase and store `refresh_token` in `tokens` table. Then fetch a snapshot (see snapshot workflow) and redirect back to the frontend page.
3. `POST /api/spotify/refresh-owner` — (protected by a secret key) server-side route to refresh the owner's access token using their refresh token, fetch owner snapshot, and upsert into `snapshots`. This route will be called twice daily by a scheduler.
4. `POST /api/spotify/fetch-user-snapshot` — when visitor completes login, this endpoint can be invoked to fetch & store their snapshot immediately (or fetching can be done client-side with the access token then POST to save snapshot).
5. `POST /api/match/compute` — given `owner_user_id` and `visitor_user_id`, load snapshots from DB and compute the compatibility result using the algorithm below. Return the structured result JSON.

**Security**

* Store Supabase `SERVICE_ROLE` key in Vercel as `SUPABASE_SERVICE_ROLE_KEY` to allow serverless to upsert tokens. Treat it as highly sensitive.
* Protect scheduled endpoints with a server-only secret (e.g., `SCHEDULER_SECRET` in Vercel env). GitHub Actions/cron will call endpoints with that secret.
* Do NOT return the service role key to the client.

---

## Snapshot fetching workflow (what to fetch)

For each user snapshot fetch the following data (use Spotify Web API endpoints):

* `GET /me/top/tracks` (limit 50) → `top_tracks`
* `GET /me/top/artists` (limit 50) → `top_artists`
* `GET /me/player/recently-played` (limit 50) → `recently_played`
* `GET /me/tracks` (liked songs, paginate until reasonable limit like 200) → `liked_tracks`
* `GET /me/playlists` → fetch user's playlists (limit 20), then fetch playlist tracks for each (aggregate to `playlists_tracks`)

When building `genres` counts, take each top artist's `genres` array and increment counts.

Store snapshot JSON in `snapshots` table with `snapshot_type`="owner" for the owner profile.

---

## Matching algorithm (deterministic, interpretable)

We’ll compute three outputs: `compatibility_score`, `top_genres`, `top_songs`.

### Basic idea

Use **Jaccard similarity** (intersection over union) for sets of tracks. Use weighted combination of several comparisons (top tracks, liked songs, playlists, recently played) and a small genre overlap component.

### Choose weights (example)

* Top tracks (top 50): **35%**
* Liked tracks (up to 200): **30%**
* Recently played (last 50): **15%**
* Playlists combined (aggregated tracks): **10%**
* Genre overlap score: **10%**

Weights sum to 1. Adjust later by experimentation.

### Per-component similarity calculations

Let `A` = set of track IDs for owner for a component and `B` = set for visitor.

**Jaccard(A,B)** = `|A ∩ B| / |A ∪ B|`.

For genres, compute normalized overlap using frequency vectors:

* Let `g_owner[g]` = owner frequency for genre `g`, `g_visitor[g]` similarly.
* Convert to frequency distributions (divide by sum). Compute **cosine similarity** or simple overlap: `genre_score = sum(min(p_owner[g], p_visitor[g]))` (which gives overlap in [0,1]).

### Combined compatibility score

```
compat_raw = w_top * Jaccard(top_tracks)
           + w_liked * Jaccard(liked_tracks)
           + w_recent * Jaccard(recently_played)
           + w_playlists * Jaccard(playlists_tracks)
           + w_genre * genre_score

compatibility_score = round(compat_raw * 100)
```

Clip to `0..100`.

### Top matching genres

Compute per-genre match contribution: `contrib[g] = min(p_owner[g], p_visitor[g])`. Sort by `contrib[g]` descending and pick top 3.

### Top matching songs

Compute the intersection of track IDs from prioritized sources in order of importance (top tracks first, then liked, then playlists, then recently played). Create a ranked list where songs present in both users' top tracks get higher rank. Return top N (say 10) with metadata pulled from Spotify (track name, artist, album art).

### Pseudocode

```js
function jaccard(setA, setB){
  const inter = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : inter/union;
}

function genreOverlap(ownerGenres, visitorGenres){
  // ownerGenres and visitorGenres are maps: {genre: count}
  const sOwner = Object.values(ownerGenres).reduce((a,b)=>a+b,0);
  const sVisitor = Object.values(visitorGenres).reduce((a,b)=>a+b,0);
  let score = 0;
  for(const g of Object.keys(ownerGenres)){
    if(visitorGenres[g]){
      score += Math.min(ownerGenres[g]/sOwner, visitorGenres[g]/sVisitor);
    }
  }
  return score; // in [0,1]
}

function computeCompatibility(ownerSnap, visitorSnap, weights){
  const w = weights;
  const comp = w.top * jaccard(new Set(ownerSnap.top_tracks), new Set(visitorSnap.top_tracks))
             + w.liked * jaccard(new Set(ownerSnap.liked_tracks), new Set(visitorSnap.liked_tracks))
             + w.recent * jaccard(new Set(ownerSnap.recently_played), new Set(visitorSnap.recently_played))
             + w.playlists * jaccard(new Set(ownerSnap.playlists_tracks), new Set(visitorSnap.playlists_tracks))
             + w.genre * genreOverlap(ownerSnap.genres, visitorSnap.genres);
  return Math.round(Math.min(1, comp) * 100);
}
```

### Edge cases & notes

* If a user has very sparse data (e.g., visitor has few liked songs), downweight components with small cardinality or use `min(countA,countB) < threshold` to avoid noise.
* Consider normalizing top tracks by recency: prioritize more recent overlap if desired.

---

## Frontend structure & UX

* Framework: React (create a Vite + React project or Next.js app if you want integrated serverless). If keeping purely static + Vercel serverless functions, a CRA or Vite app is fine.

### Pages / components

1. `Landing` — simple hero, CTA "Login with Spotify". Use Framer Motion for entrance animations.
2. `Login` — brief explanation and Spotify login button. When clicked, redirect to `/api/spotify/login`.
3. `Dashboard` — after login, show user's top artists/tracks snapshot + a big CTA: "Match with owner".
4. `Compare` — shows results: a circular compatibility meter, list of matching genres, list of top matching songs with album art. Use motion for meter and result reveal.
5. `About / How it works` — short deterministic explanation of metrics and privacy.

### Styling & colors

Follow Spotify's color scheme to feel native but avoid trademark issues:

* Background: `#121212` (dark)
* Accent (spotify green): `#1DB954`
* Text primary: `#FFFFFF` (or `#EDEDED`)
* Muted text: `#B3B3B3`

Use a modern sans-serif; spacing should be airy. Keep UI minimal with big album covers and a central compatibility card.

### Accessibility & privacy

* Always show what data you will access in the OAuth scopes screen.
* Allow users to delete their data (implement `POST /api/user/delete` that removes their snapshots and tokens).
* Display the last snapshot timestamp for transparency.

---

## Deployment steps (concise)

1. **Deploy a first revision of frontend to Vercel** (no algorithm necessary yet). Connect your GitHub repo and deploy — this gives you `https://<your-site>.vercel.app`.
2. Add `https://<your-site>.vercel.app/api/spotify/callback` as Redirect URI in Spotify Dev Dashboard.
3. In Vercel project settings, add environment variables:

   * `SPOTIFY_CLIENT_ID`
   * `SPOTIFY_CLIENT_SECRET`
   * `SUPABASE_URL`
   * `SUPABASE_SERVICE_ROLE_KEY` (service role key — keep secret)
   * `SUPABASE_ANON_KEY` (if needed for client use)
   * `SCHEDULER_SECRET` (a random string used to protect scheduled endpoints)
   * `OWNER_SPOTIFY_ID` (optional; or set on first owner OAuth)
4. Implement serverless functions (`/api/*`) and push to GitHub — Vercel auto-deploys.
5. Test the OAuth flow (log in as owner) — verify refresh token stored in Supabase.
6. Add GitHub Actions workflow to run twice daily and call `/api/spotify/refresh-owner` with `SCHEDULER_SECRET` to update owner snapshot.

**GitHub Actions cron example** (call the refresh endpoint twice daily at 03:00 and 15:00 UTC):

```yaml
name: Refresh Owner Snapshot
on:
  schedule:
    - cron: '0 3,15 * * *'
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Call refresh endpoint
        run: |
          curl -X POST https://<your-site>.vercel.app/api/spotify/refresh-owner \
            -H "Content-Type: application/json" \
            -d '{"secret":"${{ secrets.SCHEDULER_SECRET }}"}'
```

Store the `SCHEDULER_SECRET` in GitHub repo secrets (same value as in Vercel `SCHEDULER_SECRET`).

> Alternative: if you prefer Vercel-only scheduling, you can use Vercel's Cron Jobs (if available on your plan). If not, GitHub Actions cron is free and reliable.

---

## Serverless function examples (brief)

**1) Authorization URL builder**

```js
// /api/spotify/login
const scopes = ['user-library-read','user-read-recently-played','playlist-read-private','user-top-read'];
const url = `https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_CLIENT_ID}`+
  `&scope=${encodeURIComponent(scopes.join(' '))}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&state=${state}`;
// redirect browser to `url`
```

**2) Callback exchange and save refresh token**

* Exchange code for tokens via `POST https://accounts.spotify.com/api/token` (use `application/x-www-form-urlencoded`).
* Store `refresh_token` in `tokens` table for the user.

**3) Refresh & fetch snapshot**

* Use refresh token to request new access token.
* Call Spotify endpoints listed above.
* Aggregate snapshot JSON and upsert into `snapshots`.

---

## Privacy & legal notes

* Treat refresh tokens and Supabase `SERVICE_ROLE` key as secrets — store only server-side in Vercel and Supabase.
* Provide a clear privacy policy page explaining what you store and how long (e.g., snapshots kept for 90 days by default).
* Implement a data deletion endpoint and an obvious UI button for users to delete their data.

---

## Testing checklist

* [ ] OAuth flow works for owner and visitor
* [ ] Refresh token stored securely in Supabase
* [ ] Snapshot fetch returns JSON of expected shape for owner and visitor
* [ ] Matching endpoint returns understandable JSON (score, genres, songs)
* [ ] Frontend displays results and handles empty/sparse data gracefully
* [ ] Scheduler calls refresh API twice daily and owner snapshot updates

---

## Next steps & iterative improvements (future, optional)

* Add caching of Spotify metadata (track names/artwork) to avoid repeated API calls.
* Allow user to opt-in to store only ephemeral data (no refresh token saved; fetch only on login).
* Add tuning UI to adjust component weights for scoring.
* Add friend invite/link based comparisons (share match links).

---

## Appendix — Example weights & quick defaults

```json
{
  "weights": {
    "top": 0.35,
    "liked": 0.30,
    "recent": 0.15,
    "playlists": 0.10,
    "genre": 0.10
  },
  "top_results_limit": 10
}
```

---

If you'd like, I can also:

* Generate the Vercel serverless function code files for the endpoints above (Node.js / TypeScript) and a React starter app with Framer Motion skeleton.
* Produce a GitHub Actions workflow file pre-filled with your Vercel domain and secret placeholders.

Tell me which of those you'd like next and I will generate them (serverless function code, React app skeleton, or the GH Actions cron YAML).

---

*End of document.*
