/**
 * Production static file server for HCMOrbit frontend.
 *
 * Express is used (instead of `serve`) for one explicit guarantee:
 * every URL that is not a static asset returns /build/index.html, so React
 * Router can handle the route client-side. Direct hits on /reset-password,
 * /knowledge-base/<slug>, etc. no longer fall through to the home page on
 * Railway's edge.
 */
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BUILD_DIR = path.join(__dirname, 'build');

// Serve hashed CRA assets (JS/CSS/images) with their default cache headers.
app.use(express.static(BUILD_DIR));

// SPA fallback — any request that wasn't matched as a static asset above
// returns index.html so React Router can take over client-side. Using a
// catch-all middleware (instead of `app.get('*')`) keeps this compatible
// with Express 4 and Express 5+ (which dropped the bare-`*` route syntax).
app.use((req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`HCMOrbit frontend listening on port ${PORT}`);
});
