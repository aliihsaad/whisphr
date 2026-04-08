# Packaging & Distribution

## Goal

Build a standalone Windows installer so the app can be installed and launched without `npm run dev`.

## Prerequisites

- [ ] Install `electron-builder` as dev dependency
- [ ] Create a neutral app icon (`build/icon.ico`) — notes-style icon to match "My Notes" branding
- [ ] Verify `electron-vite build` produces a clean output in `out/`

## Setup Steps

### 1. Install electron-builder

```bash
npm install --save-dev electron-builder
```

### 2. Add build config to `package.json`

```json
"build": {
  "appId": "com.mynotes.app",
  "productName": "My Notes",
  "win": {
    "target": ["nsis", "portable"],
    "icon": "build/icon.ico"
  },
  "nsis": {
    "oneClick": true,
    "installerIcon": "build/icon.ico",
    "uninstallerIcon": "build/icon.ico"
  },
  "files": [
    "out/**/*"
  ],
  "directories": {
    "output": "dist"
  },
  "extraResources": []
}
```

### 3. Add package script to `package.json`

```json
"scripts": {
  "package": "electron-vite build && electron-builder --win"
}
```

### 4. Build

```bash
npm run package
```

Output:
- `dist/My Notes Setup.exe` — standard NSIS installer (installs to Program Files, adds Start Menu entry)
- `dist/My Notes.exe` — portable version (no install, runs from anywhere including USB)

## Stealth Considerations

- `productName` is "My Notes" — this is what shows in taskbar, Add/Remove Programs, Task Manager
- `appId` is generic (`com.mynotes.app`)
- Installer name will be "My Notes Setup.exe"
- Process name in Task Manager will show as "My Notes"
- The `.ico` icon should be a generic notes/notepad style icon

## Things to Verify After First Build

- [ ] Window title shows "My Notes" in taskbar and Alt-Tab
- [ ] Task Manager process name is neutral
- [ ] Installer/uninstaller works correctly
- [ ] `safeStorage` encryption works in packaged build (not just dev)
- [ ] `electron-store` config path resolves correctly in production (`%APPDATA%/interview-assistant/`)
- [ ] Auto-start on login (optional, can add later via `electron-builder` `nsis.include`)
- [ ] `.env` is NOT bundled into the package (should not be — keys are in config store)

## Optional Enhancements (Later)

- Auto-update via `electron-updater` (requires a release server or GitHub Releases)
- Code signing with a Windows certificate (removes SmartScreen warning on first run)
- Custom installer UI with license/welcome screens
- MSI target for enterprise deployment
- Rename `%APPDATA%/interview-assistant/` to `%APPDATA%/my-notes/` for full stealth
