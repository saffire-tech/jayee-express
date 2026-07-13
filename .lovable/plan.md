Plan to fix the keypad-phone white screen:

1. Replace the current `noscript`-only fallback with a plain HTML fallback that is visible by default in `index.html`.
   - The full React app will hide it only after the modern app actually loads.
   - This handles keypad/older browsers that partially support JavaScript but cannot run modern ES modules, which commonly causes a white screen while also preventing `noscript` from showing.

2. Add a `nomodule` / old-browser redirect path.
   - Browsers that cannot run modern module scripts will be sent to the lite experience automatically.
   - If redirect fails, the visible fallback still remains on screen.

3. Add static lite fallback pages under the public site assets.
   - A basic `/lite/index.html`, `/lite/stores/index.html`, and `/lite/products/index.html` will render without JavaScript, external fonts, or complex CSS.
   - These pages will provide store/product browsing entry points, city filters for Tamale and Wa, and contact/order support.
   - The existing dynamic lite backend pages can remain for richer data where supported, but the static pages prevent blank screens on very limited phones.

4. Update fallback links to use the most compatible URLs.
   - Use simple `.html`/directory links and avoid relying only on Vercel rewrites or JavaScript routing.

5. Verify locally with JavaScript disabled and with an old-browser simulation.
   - Confirm the root page no longer becomes blank.
   - Confirm lite pages open as plain HTML.