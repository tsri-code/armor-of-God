#!/bin/bash

# Setup script for Safari wrapper
# This script helps prepare the extension for Safari packaging

set -e

echo "🍎 Setting up Safari wrapper for Armor of God extension"

# Check if extension is built
EXTENSION_DIR="../extension/dist"
if [ ! -d "$EXTENSION_DIR" ]; then
    echo "❌ Extension not built. Please run 'cd ../extension && npm run build' first"
    exit 1
fi

# Check if manifest exists
if [ ! -f "$EXTENSION_DIR/manifest.json" ]; then
    echo "❌ Extension manifest not found in $EXTENSION_DIR"
    exit 1
fi

echo "✅ Extension found in $EXTENSION_DIR"

# Create assets directory if it doesn't exist
mkdir -p "assets/icons"

# Copy icons if they exist in the extension
if [ -d "$EXTENSION_DIR/assets" ]; then
    echo "📱 Copying extension assets..."
    cp -r "$EXTENSION_DIR/assets/"* "assets/" 2>/dev/null || true
fi

# Generate app icons from extension icon if available
if [ -f "assets/icon-128.png" ]; then
    echo "🎨 Generating app icons from extension icon..."

    # Check if ImageMagick is available
    if command -v convert &> /dev/null; then
        # Generate various icon sizes for macOS app
        convert "assets/icon-128.png" -resize 16x16 "assets/icons/icon-16.png"
        convert "assets/icon-128.png" -resize 32x32 "assets/icons/icon-32.png"
        convert "assets/icon-128.png" -resize 64x64 "assets/icons/icon-64.png"
        convert "assets/icon-128.png" -resize 128x128 "assets/icons/icon-128.png"
        convert "assets/icon-128.png" -resize 256x256 "assets/icons/icon-256.png"
        convert "assets/icon-128.png" -resize 512x512 "assets/icons/icon-512.png"
        convert "assets/icon-128.png" -resize 1024x1024 "assets/icons/icon-1024.png"

        echo "✅ App icons generated"
    else
        echo "⚠️  ImageMagick not found. Please generate app icons manually or install ImageMagick."
        echo "   Sizes needed: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024"
    fi
fi

# Create configuration templates
echo "📝 Creating configuration templates..."

# Create entitlements template
cat > "ArmorOfGod.entitlements.template" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.security.app-sandbox</key>
	<true/>
	<key>com.apple.security.network.client</key>
	<true/>
	<key>com.apple.security.network.server</key>
	<false/>
	<key>com.apple.security.files.user-selected.read-write</key>
	<false/>
	<key>com.apple.security.files.downloads.read-write</key>
	<false/>
</dict>
</plist>
EOF

# Create Info.plist template
cat > "Info.plist.template" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIconFile</key>
	<string></string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
	<key>CFBundleShortVersionString</key>
	<string>0.1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>LSApplicationCategoryType</key>
	<string>public.app-category.productivity</string>
	<key>LSMinimumSystemVersion</key>
	<string>$(MACOSX_DEPLOYMENT_TARGET)</string>
	<key>NSHumanReadableCopyright</key>
	<string>Copyright © 2024 Armor of God. All rights reserved.</string>
	<key>NSMainStoryboardFile</key>
	<string>Main</string>
	<key>NSPrincipalClass</key>
	<string>NSApplication</string>
</dict>
</plist>
EOF

# Create Swift file templates
mkdir -p "templates"

cat > "templates/AppDelegate.swift" << 'EOF'
//
//  AppDelegate.swift
//  Armor of God
//
//  Created by Safari Extension Converter.
//

import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        // Insert code here to initialize your application
    }

    func applicationWillTerminate(_ aNotification: Notification) {
        // Insert code here to tear down your application
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return true
    }
}
EOF

cat > "templates/ViewController.swift" << 'EOF'
//
//  ViewController.swift
//  Armor of God
//
//  Created by Safari Extension Converter.
//

import Cocoa
import SafariServices

class ViewController: NSViewController {

    @IBOutlet var appNameLabel: NSTextField!

    override func viewDidLoad() {
        super.viewDidLoad()
        self.appNameLabel.stringValue = "Armor of God";
    }

    @IBAction func openSafariExtensionPreferences(_ sender: AnyObject?) {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: "com.armorofgod.safari.Extension") { error in
            if let _ = error {
                // Insert code to inform the user that something went wrong.
            }
        }
    }

}
EOF

cat > "templates/SafariWebExtensionHandler.swift" << 'EOF'
//
//  SafariWebExtensionHandler.swift
//  Armor of God Extension
//
//  Created by Safari Extension Converter.
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems[0] as! NSExtensionItem
        let message = item.userInfo?[SFExtensionMessageKey]
        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@", message as! CVarArg)

        let response = NSExtensionItem()
        response.userInfo = [ SFExtensionMessageKey: [ "Response to": message ] ]

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

}
EOF

echo "✅ Template files created in templates/ directory"

# Create package.json for Safari-specific tasks
cat > "package.json" << 'EOF'
{
  "name": "@armor-of-god/safari-wrapper",
  "version": "0.1.0",
  "description": "Safari app wrapper for Armor of God extension",
  "scripts": {
    "setup": "./setup-safari.sh",
    "build-extension": "cd ../extension && npm run build",
    "update-extension": "npm run build-extension && ./update-extension.sh",
    "clean": "rm -rf build/ DerivedData/"
  },
  "keywords": ["safari", "extension", "christian", "content-filter"],
  "license": "MIT"
}
EOF

# Create update script
cat > "update-extension.sh" << 'EOF'
#!/bin/bash

# Update extension files in Xcode project
# Run this after rebuilding the extension

echo "🔄 Updating Safari extension files..."

EXTENSION_DIR="../extension/dist"
XCODE_EXTENSION_DIR="./Shared (Extension)/Resources"

if [ ! -d "$EXTENSION_DIR" ]; then
    echo "❌ Extension not built. Run 'npm run build-extension' first."
    exit 1
fi

if [ ! -d "$XCODE_EXTENSION_DIR" ]; then
    echo "❌ Xcode project not found. Please create the Safari Extension App in Xcode first."
    echo "   See README.md for instructions."
    exit 1
fi

# Copy extension files
echo "📂 Copying extension files..."
cp -r "$EXTENSION_DIR/"* "$XCODE_EXTENSION_DIR/"

# Update version in Info.plist if it exists
if [ -f "$XCODE_EXTENSION_DIR/../Info.plist" ]; then
    MANIFEST_VERSION=$(grep -o '"version": *"[^"]*"' "$EXTENSION_DIR/manifest.json" | sed 's/.*"version": *"\([^"]*\)".*/\1/')
    if [ ! -z "$MANIFEST_VERSION" ]; then
        plutil -replace CFBundleShortVersionString -string "$MANIFEST_VERSION" "$XCODE_EXTENSION_DIR/../Info.plist"
        echo "✅ Updated Info.plist version to $MANIFEST_VERSION"
    fi
fi

echo "✅ Safari extension updated"
echo "   Remember to rebuild in Xcode before testing"
EOF

chmod +x "update-extension.sh"

echo ""
echo "🎉 Safari wrapper setup complete!"
echo ""
echo "Next steps:"
echo "1. Open Xcode"
echo "2. Create a new Safari Extension App project"
echo "3. Point it to the extension directory: $EXTENSION_DIR"
echo "4. Use the template files in templates/ directory"
echo "5. Copy the entitlements and Info.plist templates"
echo ""
echo "Useful commands:"
echo "  npm run build-extension  # Rebuild the extension"
echo "  npm run update-extension # Update Safari project with latest extension"
echo ""
echo "See README.md for detailed instructions."
EOF

chmod +x setup-safari.sh
