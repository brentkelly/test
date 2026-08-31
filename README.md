# test

## Contact form

`contact.html` is a standalone contact page — a Name field, a Message field and
a Send button that deliberately does nothing. Open it directly in a browser; it
has no build step and no dependencies.

### Tests

```
node --test
```

Requires Node 22+ (the browser tests use the global `WebSocket`). The structural tests run anywhere. The browser tests drive a
headless Chromium over the DevTools Protocol; they are skipped if no browser is
found, and `CHROME_PATH` can point at one explicitly.

## Services

Four static pages, one set: `services.html` is the index, and it links the three
service pages — `clock-repairs.html`, `watch-repairs.html` and
`skateboard-repairs.html`. Each ships as markup alone; the shared list and
back-link rules live in `styles.css`, so a new service page needs no CSS of its
own.

The service pages land on their own cards, so the index's links 404 until those
merge. Nothing on `index.html` points at `services.html` yet either — site-wide
navigation is a separate card.

Page tests share `test-helpers/page.mjs` (`loadPage`, `assertDocumentShell`,
`countSentences`). `about.test.mjs` and `social.test.mjs` predate it and still
carry their own copies of those helpers.
