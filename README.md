# Tip Pool

Static browser app for calculating and distributing a tip pool from available
cash.

## Live entry point

Open `index.html` directly in a browser, or serve this repository root with any
static file server.

The app is intentionally framework-free. Scripts are loaded as ordered global
files from `js/`, and styles are loaded from `css/`.

## Tests

Run the distribution-engine checks with:

```bash
node js/engine.test.js
```

Run utility parsing checks with:

```bash
node js/utils.test.js
```
