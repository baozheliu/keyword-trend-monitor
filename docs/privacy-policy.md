# Keyword Watch — Privacy Policy

**Last updated:** 2026-07-19

Keyword Watch（关键词趋势监测）is a browser extension that helps you subscribe to keywords and monitor search-interest trends from Baidu Index and Google Trends. This policy explains what data the extension handles and how that data is used.

## Summary

- All subscription settings, trend history, and alerts are stored **locally** in your browser (`chrome.storage.local`).
- The extension does **not** operate a backend server and does **not** upload your data to the developer.
- To fetch trend data, the extension sends your subscribed **keywords** (and selected region settings) to Baidu Index and/or Google Trends.
- The extension does **not** sell user data, does **not** use it for advertising, and does **not** share it with unrelated third parties.

## Data the extension handles

| Category | What | Where it goes |
| --- | --- | --- |
| User content | Subscription names, keywords, alert template/sensitivity choices, optional custom icons | Stored locally; keywords and region are also sent to the selected data source when fetching |
| Website content | Daily index/trend values returned by Baidu Index / Google Trends | Stored locally for charts and alerts |
| Authentication information | Presence of Baidu’s `BDUSS` session cookie on `index.baidu.com` | Checked in memory only to detect login; **value is never saved or transmitted by the extension** |
| Settings | Theme-related UI preferences implied by the browser; last-check timestamps; unread alert state | Stored locally |

The extension does **not** collect: browsing history of other sites, page content from sites you visit, precise location, contacts, payment information, or analytics/telemetry about how you use the extension.

## Permissions

- **storage** — Save subscriptions, series history, alerts, and UI state on this device.
- **alarms** — Run the hourly refresh schedule.
- **cookies** — Detect whether you are logged in to Baidu Index (observe whether the `BDUSS` cookie exists / changes). Cookie values are not persisted by the extension.
- **Host access to `https://index.baidu.com/*` and `https://trends.google.com/*`** — Request trend data for your subscribed keywords from those two sources only.

There is no content script. The extension does not inject code into arbitrary websites.

## Network requests

When a check runs (hourly, on browser restart catch-up, after Baidu login is detected, or when you tap refresh), the extension may request data from:

1. **Baidu Index** (`index.baidu.com`) — using your existing browser login session (`credentials: include`). Your keywords and selected area are included in the request.
2. **Google Trends** (`trends.google.com`) — public web endpoints; your keywords and selected geo are included in the request.

Those services process requests under their own privacy policies. Keyword Watch does not control Baidu’s or Google’s retention of request logs.

## Remote code

All executable logic ships inside the extension package. The extension does **not** download or execute remote JavaScript or Wasm.

## Retention and deletion

- Local data remains until you delete a subscription (which removes its series, alerts, and related state), clear the extension’s storage, or uninstall the extension.
- Uninstalling the extension removes its local storage from the browser.

## Children’s privacy

The extension is not directed at children under 13. Do not use it to submit personal information about children.

## Changes

If this policy changes in a material way, the “Last updated” date above will be revised. Continued use after an update means you accept the revised policy.

## Contact

Questions about this policy: contact the publisher through the support channel listed on the extension store listing or through the project repository: https://github.com/baozheliu/keyword-trend-monitor/issues

Public URL: https://keyword-watch-privacy.pages.dev/
