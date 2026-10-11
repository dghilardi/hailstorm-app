# Hailstorm App
[![Test Status](https://github.com/dghilardi/hailstorm-app/actions/workflows/test.yml/badge.svg)](https://github.com/dghilardi/hailstorm-app/actions/workflows/test.yml)

Project and launch hailstorm simulations

![App Screens](img/app-screens.png)

## Web frontend

The same React interface runs in a browser or in Tauri. In the browser it uses
`/api/hailstorm/` APIs on the page's origin, matching the controller's default
REST base path. Tauri continues to read
`hailstorm-app/config.yml` from the user configuration directory and defaults to
the embedded backend at `http://localhost:54321`. Existing `hostname` and `port`
entries remain supported; a backend may also specify `baseUrl`, including an HTTPS
URL and an optional proxy prefix. For a hailstorm service controller include its
REST base path, for example `baseUrl: http://controller:8200/api`.

Browser project actions are New, Import and Export, using the existing `.hsp` YAML
format. Import/export transfers files; it does not persist projects on the server.
The desktop retains its native file menu and command-line project argument.

For controllers exposing `/api/hailstorm/simulation/status`, the UI shows agent states
and errors. Start requires a successful load of the current editor contents and
confirmation that all agents are ready for the returned simulation identifier.
Editing the script or curves requires loading the project again. Stop requests
a shutdown; the UI waits for agents to leave running/stopping states before allowing
another load. Older embedded backends returning `{ "outcome": "ok" }` and lacking
status retain Load/Start and reload behavior; live status and Stop are unavailable.

### Build and package

Requires Node.js 22, Yarn Classic, Git and `tar`.

```sh
yarn install --frozen-lockfile
yarn test --watchAll=false --runInBand
yarn package:web
```

The command builds with relative asset URLs and creates:

```text
artifacts/hailstorm-web-0.2.2.tar.gz
artifacts/hailstorm-web-0.2.2.tar.gz.sha256
```

The archive contains the contents of `build/`, including Monaco and its workers,
fonts, and `hailstorm-web.json` with the artifact version, app version and source
commit plus whether the source checkout had uncommitted changes. No CDN or Node.js
server is required at runtime. `yarn build` remains the
desktop build command; `yarn start` prepares local Monaco assets for development.

CI tests frontend behavior, packages the web build and uploads it as a workflow
artifact. Release tags use the existing numeric format, for example `0.3.0`, and
must match `package.json`. The release workflow attaches the archive and checksum
to the existing `app-v0.3.0` draft release alongside desktop installers. It leaves
the release in draft for review.

### Include in a controller image

Download the archive and checksum from the same reviewed release during the image
build, pinning a specific version. Verify and extract them:

```sh
sha256sum -c hailstorm-web-0.2.2.tar.gz.sha256
mkdir -p /app/web
tar -xzf hailstorm-web-0.2.2.tar.gz -C /app/web
```

Serve `/app/web` under `/ui/` (redirect `/ui` to `/ui/`) or at `/`. Keep
`/api/hailstorm/` routed to the controller API, including status and stop. API errors
must return their HTTP status rather than the frontend's `index.html`. With Actix,
the static service can use `actix_files::Files::new("/ui", "/app/web")` and
`.index_file("index.html")`; register API services before a root static service.
This repository produces the frontend artifact; the microservice's static-file
route and image integration belong in its own repository.

Use runtime configuration for agent credentials, datasets and environment-specific
targets. Browser API calls use the same origin even when the UI is under `/ui/`.
The UI controls the controller's shared active simulation; separate controller
deployments are needed for independent simultaneous runs.

The desktop agent uses Hailstorm 0.3 and Rune 0.14 at the tested revision pinned
in `src-tauri/Cargo.toml`, fetched over public HTTPS. Rust 1.88 or newer is
required by the updated dependencies. The desktop runtime remains on Tauri 1.
