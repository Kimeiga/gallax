# Gallax Multiplayer Test Suite

## Prerequisites
- Node.js 20+
- Playwright: `npm install --save-dev playwright && npx playwright install chromium`

## Running Tests

### Full multiplayer test (production)
Tests all networked systems between two isolated browser contexts:
```bash
node test_prod_full.mjs
```
**Tests:** Connection, Chat, Pixels (draw + erase), Pixel D1 persistence, Buildings (place + delete), Name change, Home interior presence, Map player visibility, Resource collection, Console errors.

### Home-specific tests (production)
Tests home emoji/tint changes, furniture live sync, and persistence:
```bash
node test_home_detailed.mjs
```
**Tests:** Emoji change sync, Tint change sync, Furniture live placement, Furniture persistence after exit/re-enter.

## How the tests work
- **Playwright** launches headed Chromium with **two separate browser contexts** (isolated localStorage, cookies, network)
- Each context gets a unique guest ID (auto-generated on page load)
- Each connects to the geckos.io server at `game.kimu.nyc` with a unique player ID
- Tests use `page.evaluate()` to call game functions and verify state
- Screenshots saved to `/tmp/` for visual verification

## Test architecture
```
Browser Context 1 (Player 1)    Browser Context 2 (Player 2)
        │                                │
        ├── localStorage (unique)        ├── localStorage (unique)
        ├── Guest ID: guest_xxx          ├── Guest ID: guest_yyy
        ├── Geckos ID: abc...            ├── Geckos ID: def...
        │                                │
        └──── game.kimu.nyc (geckos server) ────┘
                    │
              Broadcasts events to all
```

## Adding new tests
1. Add test logic inside `main()` using `p1.evaluate()` / `p2.evaluate()`
2. Use `await new Promise(r => setTimeout(r, 2000))` between actions (network propagation)
3. Use the `log(name, boolean, detail)` helper for pass/fail reporting

## Running against localhost
The geckos server connects to `game.kimu.nyc` in production and `localhost:3000` in dev.
For local testing with D1 (no geckos), use:
```bash
npx wrangler pages dev dist --local --port 8788
# Then change URL in test to http://localhost:8788
```
Note: Local tests won't have geckos multiplayer unless you also run the geckos server locally.

## Common issues
- **Headless mode fails**: Mapbox GL requires WebGL → use `headless: false`
- **Geckos timeout**: The server at `game.kimu.nyc` might be restarting → wait and retry
- **401 on D1 APIs**: Guest not registered → ensure page fully loads before API calls
