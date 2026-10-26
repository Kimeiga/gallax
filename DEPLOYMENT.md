# Paired production releases

The public game is https://gallax.pages.dev with its backend at https://game.kimu.nyc.
Both packages pin Twinwire 2.2.0 / wire 4. Activate a matching client and backend together.

Build the browser with `VITE_MAPBOX_TOKEN` set to the existing public Mapbox key, then run
`npm run build:production`. This fails before deployment when the setting is absent.
`npm run build` remains a compilation check; its success alone does not verify a usable map.
The key is supplied through the environment and must not be added to Git.

Build the server with `npm ci --prefix geckos-server` and `npm run build --prefix geckos-server`.
The runtime artifact needs the complete `geckos-server/dist` directory, including `contract.json`,
and its own package and lock files. Install production dependencies with Node 22 or newer.
Check the installed SDK, native adapter and `/health` on separate staging ports before activation.

Preserve the current backend directory and process-manager configuration. Use a new release
directory and explicitly verify PM2's script, working directory and interpreter after switching;
`startOrReload` can retain the old script path. Keep the previous Pages deployment ID for paired
rollback. `npm run cf:deploy` publishes the prepared client; it does not switch the backend.

Buildings, furniture, pixels and ownership live in D1. Back up the database before a release;
this transport migration needs no schema migration or data reset. Browser acceptance should use
new guest sessions and test-owned data. Check movement, peer snapshots, a network drop, the same
player and position after resume, and exactly one delivery of a queued chat message on RTC and WS.
