# URL Visit Stats

A Firefox extension that tracks local visit counts for HTTP and HTTPS URLs. It can also mark pages as read or unread without using Firefox history or sending browsing data to a remote service.

## Features

- View exact URL, normalized URL, and host visit counts for the current page.
- View first and most recent visit times recorded by the extension.
- Browse collapsible top URL and host rankings.
- Mark the current page as read or unread. Read pages show a green check badge on the toolbar icon.
- Export a local JSON backup or import one using merge or overwrite mode.
- Configure URL normalization.

Normalization can ignore hash fragments, trailing slashes, and configured tracking query parameters. Remaining query parameters are sorted so equivalent parameter orders count as the same normalized URL. Exact URL counts always use the original URL.

All counters start when the extension is installed or enabled. It does not import existing Firefox history.

## Privacy

The extension stores the following data locally in the current Firefox profile using `browser.storage.local`:

- Complete HTTP and HTTPS URLs, including query strings and hash fragments, for exact URL counts.
- Normalized URLs and hostnames.
- Page titles, visit counts, and first and most recent visit timestamps.
- Pages manually marked as read, including their URL, title, and marked time.
- Normalization settings and popup section state.

No data is transmitted outside Firefox. The extension contains no analytics, advertising, telemetry, remote API calls, or remote code. It does not request access to Firefox history.

Private browsing is disabled for this extension, so private tabs and windows are not visible to it and their browsing data is not stored.

Backup export happens only after the user selects **Export backup** and creates a JSON file on the local device. Import reads only the local backup file selected by the user. The extension does not upload backup files.

## Permissions

- `tabs`: Reads HTTP and HTTPS tab URLs and page titles, records completed page loads, and updates the read badge for the current tab.
- `storage`: Stores visit statistics, read markers, settings, and popup state locally in the Firefox profile.

## Data management

- **Clear visit counts** removes visit counts and timestamps while keeping read markers and settings.
- **Import and merge** adds imported counts and combines read markers while keeping the current settings. Importing the same backup repeatedly adds its counts repeatedly.
- **Import and overwrite** replaces visit statistics, read markers, and settings with the imported backup.

## Installation

Install the signed release from Mozilla Firefox Add-ons after publication.

## Development

### Temporary installation

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json` from this directory.
4. Visit a few pages, then click the toolbar button.

Temporary add-ons are removed when Firefox restarts. Export a backup before removing or restarting a temporary installation if its local data needs to be retained.

### Validation and packaging

Install Mozilla's `web-ext` tool, then run:

```sh
web-ext lint
web-ext build --filename "url-visit-stats-{version}.zip"
```

The package is written to `web-ext-artifacts/` and can be submitted to Mozilla Add-ons for review and signing.
