# Dragons & Airfields

A private asynchronous chess table for **Gideon and Grandpa**, with a U.S. WWII airfield blended into a dragon mountain stronghold. Modern illustrated pieces have standard chess symbols. The front end is a self-contained `index.html` that runs on GitHub Pages.

## What is built

- Separate private player links; no account creation or login screens.
- One active game. A secure coin flip chooses white, who chooses their theme. The other player receives the remaining theme.
- Legal moves enforced in the browser **and on the server**, including check, castling, en passant, and all four promotion choices.
- Submitted moves remain undoable for exactly 30 seconds. The opponent cannot see or respond to the move until the server releases it. Closing the page does not cancel the timer.
- One email to the next player after a move is released. No daily emails or turn deadlines. Checkmate and other game-ending moves do not send a turn reminder.
- Shared win/loss/draw totals and dated game history, with resignations, draw offers, and rematches.
- Click or tap to move, legal-move highlights, last-move highlights, keyboard navigation, board rotation, a piece guide, and reminder settings. Controls have larger tap targets; turn status appears above the board on tablets, and tablet tools retain their text labels.
- A light neutral gray background, stronger label contrast, visible keyboard focus, named dialogs, and spoken turn updates. Failed email saves keep the form and entered address open for retry.
- Default reminder address for both players: `acegielski@gmail.com`. Each player can change their own address later.

## Try the page first

Open `index.html` in a browser. With no private-link fragment it runs a clearly labeled **preview on this device**. Use the Gideon/Grandpa controls to try both sides. Preview history is saved in that browser only; no email is sent and this mode cannot synchronize separate devices.

For a local web preview:

```sh
npm ci
npm run preview
```

Open `http://localhost:4173`. To rebuild the self-contained page after edits, run `npm run build`.

## Put the page on GitHub

1. Add this project to your GitHub repository. Keep the default branch named `main`, or change `.github/workflows/pages.yml` to the actual branch name.
2. In the repository, open **Settings → Pages → Source → GitHub Actions**.
3. Run the included **Publish chess page** workflow. It publishes only `index.html`; backend source, secrets, and private links are excluded from the published page.

You can also upload **only `index.html`** to an existing GitHub Pages site without changing its workflow. No build step or external asset files are required for the page.

## Activate shared play and turn emails

GitHub Pages hosts static pages; shared state and timed email delivery run in the included Cloudflare Worker. A Durable Object stores the family game and runs the 30-second release alarm even when both browsers are closed. Resend sends the email. These services require your own accounts; no accounts were created and nothing was deployed or emailed during this build. Review the providers' current account limits and pricing before activation.

1. Create or use a Cloudflare Workers account and a Resend account. Set up an approved sender with Resend. For production, verify your sending domain. A Resend test sender can have recipient restrictions.
2. Run `npm ci` and `npx wrangler login` from this project.
3. In `backend/wrangler.jsonc`, replace these public settings:
   - `PUBLIC_PAGE_URL`: your complete HTTPS GitHub Pages URL, including the repository path and trailing slash.
   - `API_URL`: the deployed Worker's origin, for example `https://dragons-and-airfields.your-subdomain.workers.dev`. It must match the actual service origin.
   - `EMAIL_FROM`: your approved Resend sender, for example `Dragons & Airfields <chess@your-domain.com>`.
4. Create a strong random setup secret, and retain it in your password manager. Store it with `npx wrangler secret put SETUP_SECRET --config backend/wrangler.jsonc`. Enter the secret at the prompt.
5. Store your Resend API key with `npx wrangler secret put RESEND_API_KEY --config backend/wrangler.jsonc`. Enter the key at the prompt. Do not add keys to the HTML, repository, or configuration file.
6. Run `npm run deploy`. If the Workers URL differs from the `API_URL` setting, update that setting and redeploy.
7. Set `SETUP_SECRET` in your local terminal environment to the same secret, then run `npm run setup -- https://your-service.workers.dev`. The script writes **private-links.json** locally. It is excluded from git and must remain private.
8. Bookmark Gideon's link on his laptop and Grandpa's link on his devices. The fragments identify the players automatically and tell the page which game service to use. You do **not** need to edit or rebuild `index.html` to use these links.
9. Verify one released move sends an email to `acegielski@gmail.com`. Later, open each player's **Reminders** setting to change that player's address.

The setup endpoint is idempotent: rerunning it with the setup secret returns the same links and preserves the game. There is no public reset endpoint. Anyone holding a player's private link can play as that player; share it only with its intended player. URLs keep player keys in the fragment, away from GitHub request logs, and the page disables referrer transmission.

## Design and piece roles

| Chess role | U.S. WWII theme | Dragon theme |
|---|---|---|
| King | Commander | Dragon king |
| Queen | P-51 Mustang | Winged queen |
| Rook | Sherman tank | Dragon tower |
| Bishop | Radio tower | Mystic dragon |
| Knight | Willys jeep | Wyvern |
| Pawn | Infantry helmet | Hatchling |

All six WWII roles use U.S. designs, so British substitutes were unnecessary. White and black are identified by ivory and dark bases and symbol badges, independent of their chosen theme.

## Technical notes

- The backend owns player identity, turn order, revision checking, game outcomes, move validation, and undo deadlines. Changing browser state cannot bypass these rules.
- Both requests and Durable Object alarms settle moves. Alarms and outbox changes are persisted with game changes. Email attempts use stable idempotency keys, retry temporary failures, and discard reminders if their turn has already passed.
- The browser polls every five seconds while visible and refreshes after returning to the page. The timer uses server time. A released move may appear a few seconds after its deadline depending on network and polling.
- Standard movement rules are implemented with bundled `chess.js` 1.4.0, without a CDN. Threefold repetition and the fifty-move rule automatically finish a game as a draw, appropriate for this family game.
- Click/tap and keyboard movement are implemented; drag-and-drop is not required. Arrow keys move square focus, Enter or Space selects, and Escape clears selection.
- There is no authentication provider, paid SMS integration, daily scheduler, analytics, or public game directory.

Run `npm test` for the game and backend checks. The build was also validated with a Wrangler deployment dry run. A live end-to-end email check is still required after credentials are configured.

## Source references

- [chess.js](https://github.com/jhlywa/chess.js) — licensed under BSD-2-Clause; its license is included in `CHESS-LICENSE.txt`.
- [Cloudflare Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/).
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
- [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email).
- [GitHub Pages deployment with Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Original board art and interface code are included under the project's MIT license.
