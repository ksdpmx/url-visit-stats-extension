# URL Visit Stats

A small Firefox WebExtension for generic local URL visit statistics.

## What it tracks

- Exact URL counts stored locally after the extension is installed.
- Normalized URL counts stored locally after the extension is installed.
- Host-level counts stored locally after the extension is installed.
- Collapsible top URL and host rankings, plus JSON backup/restore.
- Mark the current page as read/unread from the popup. Read pages show a green ✓ badge on the toolbar icon.

Normalization can ignore hash fragments, trailing slashes, and common tracking query parameters.

## Install for local testing

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json` from this directory.
4. Visit a few pages, then click the toolbar button.

Temporary add-ons are removed when Firefox restarts. For persistent use, package and sign it through Mozilla Add-ons or use a developer/nightly profile that allows unsigned extensions.

Before removing or restarting a temporary installation, open **Options** and choose **Export backup**. After loading the extension again, use **Import and overwrite** to restore the counters, read markers, and settings. Use **Import and merge** to add counters and read markers to the current data while keeping the current settings. Merging the same backup more than once adds its counts more than once.

## Privacy

The extension keeps its own lightweight local stats in `browser.storage.local`. It does not send data anywhere and does not request Firefox history access.

## Notes

All counters start from the moment the extension is installed or enabled.
