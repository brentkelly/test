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
