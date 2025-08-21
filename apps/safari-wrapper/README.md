# Safari Wrapper for Armor of God Extension

This directory contains the setup and configuration for the Safari version of the Armor of God extension.

## Overview

Safari web extensions require a native app wrapper. This wrapper:
- Packages the web extension for Safari
- Provides macOS and iOS compatibility
- Enables App Store distribution
- Adds Safari-specific features

## Prerequisites

- Xcode 14 or later
- macOS 13 Ventura or later
- Apple Developer Account (for distribution)
- Built extension in `../extension/dist`

## Setup Instructions

### 1. Build the Extension First

```bash
cd ../extension
npm run build
```

### 2. Create Safari Extension Project

1. Open Xcode
2. File → New → Project
3. Choose "Safari Extension App" template
4. Configure project:
   - Product Name: "Armor of God"
   - Bundle Identifier: "com.armorofgod.safari"
   - Organization Identifier: Your reverse domain
   - Language: Swift
   - Use Core Data: No

### 3. Configure Extension

1. When prompted, point to the built extension directory: `../extension/dist`
2. Xcode will copy and configure the extension automatically
3. Update the Info.plist files as needed

### 4. Project Structure

After creation, the project will have:
```
Armor of God/
├── Armor of God.xcodeproj
├── Armor of God/              # macOS app
│   ├── AppDelegate.swift
│   ├── ViewController.swift
│   ├── Info.plist
│   └── Armor of God.entitlements
├── Shared (Extension)/        # Shared extension code
│   ├── Resources/            # Extension files (copied from dist)
│   └── SafariWebExtensionHandler.swift
└── Armor of God (iOS)/       # iOS app (optional)
    ├── AppDelegate.swift
    ├── SceneDelegate.swift
    ├── ViewController.swift
    └── Info.plist
```

## Configuration Files

### App Configuration (Info.plist)

Key settings for the main app:
- `NSHumanReadableCopyright`: Copyright notice
- `NSMainStoryboardFile`: Main storyboard
- `LSApplicationCategoryType`: Productivity or Utilities

### Extension Configuration

The extension's `manifest.json` should already be configured for Safari compatibility.

### Entitlements

Required entitlements:
- `com.apple.security.app-sandbox`: YES
- `com.apple.security.network.client`: YES (for verse API)
- `com.apple.security.files.user-selected.read-write`: NO
- `com.apple.security.files.downloads.read-write`: NO

## Building and Testing

### Debug Build

1. Select the Armor of God scheme
2. Choose macOS destination
3. Press Cmd+R to run

### Testing the Extension

1. Run the app
2. Open Safari
3. Safari → Settings → Extensions
4. Enable "Armor of God" extension
5. Test functionality on various websites

### iOS Build (Optional)

1. Select the "Armor of God (iOS)" scheme
2. Choose iOS Simulator or device
3. Press Cmd+R to run

## Distribution

### Mac App Store

1. Archive the app (Product → Archive)
2. Use Organizer to validate and submit
3. Configure App Store metadata
4. Submit for review

### Direct Distribution

1. Archive the app
2. Export for Developer ID distribution
3. Notarize the app with Apple
4. Distribute the .dmg file

## Content Blocking (Optional Enhancement)

For improved performance on iOS, consider adding a Content Blocker:

1. Add Content Blocker Extension target
2. Create blocking rules in JSON format
3. Implement ContentBlockerRequestHandler
4. Enable in Safari settings

## Troubleshooting

### Extension Not Loading

1. Check that the extension is properly built
2. Verify manifest.json is valid
3. Check browser console for errors
4. Ensure all resources are web-accessible

### Permission Issues

1. Verify entitlements are correct
2. Check sandbox restrictions
3. Ensure network permissions for API calls

### API Key Security

The extension uses a worker proxy, so no API keys are embedded in the Safari extension. The worker handles all Scripture API calls securely.

## Development Notes

### Updating the Extension

When updating the web extension:

1. Rebuild: `cd ../extension && npm run build`
2. Copy new files to Xcode project
3. Update version numbers in both manifest.json and Info.plist
4. Test thoroughly before distribution

### Version Management

Keep version numbers synchronized:
- `manifest.json` version
- macOS app CFBundleShortVersionString
- iOS app CFBundleShortVersionString

### App Store Guidelines

Ensure compliance with:
- App Store Review Guidelines
- Safari Extension Guidelines
- Content filtering policies
- Privacy requirements

## Support Files

This directory also contains template files that can be customized:
- App icons in various sizes
- Default app interface
- Extension configuration
- Privacy policy and terms of service templates
