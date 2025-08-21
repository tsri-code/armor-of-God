# Privacy Policy - Armor of God Extension

**Effective Date:** [INSERT DATE]

## 🛡️ **Our Commitment to Privacy**

The Armor of God extension is designed with privacy as a core principle. We believe in protecting your browsing experience while respecting your personal data.

## 📊 **Data We Collect**

### ✅ **Data Stored Locally (On Your Device Only)**

- **Extension Settings**: Your preferences, sensitivity levels, whitelist/blacklist
- **PIN Hash**: Cryptographically secured admin PIN (never stored in plain text)
- **Usage Statistics**: Optional anonymous counts (blocked images, sites, etc.)
- **Cached Verses**: Daily Bible verses cached for offline use

### ❌ **Data We DO NOT Collect**

- ❌ Browsing history or URLs visited
- ❌ Personal information or identity data
- ❌ Images or content you view
- ❌ Passwords or sensitive form data
- ❌ Location or device information

## 🖥️ **How We Process Data**

### **Local Processing Only**

- **Image Scanning**: All AI analysis happens on your device using TensorFlow.js
- **Content Filtering**: Rules applied locally in your browser
- **Settings**: Stored in browser's local storage, never transmitted

### **External Services**

- **Bible Verses**: Fetched from Scripture API (scripture.api.bible) via our secure proxy
- **Safe Search**: Direct browser requests to search engines with safe parameters

## 🌐 **Third-Party Services**

### **Scripture API**

- **Purpose**: Fetch daily Bible verses
- **Data Sent**: Only verse reference requests (e.g., "John 3:16")
- **Privacy**: No personal data transmitted
- **Provider**: American Bible Society (scripture.api.bible)

### **Search Engines**

- **Purpose**: Enforce safe search parameters
- **Data Sent**: Your search queries (normal browser behavior)
- **Privacy**: We only add safety parameters, don't intercept queries

## 🔒 **Data Security**

- **Encryption**: Admin PIN secured with PBKDF2 + SHA-256
- **Local Storage**: All data stays on your device
- **No Cloud Sync**: Settings don't sync between devices (coming in future versions)
- **Secure Communication**: All API requests use HTTPS

## 👤 **Your Rights**

- **Access**: View your settings anytime in the extension options
- **Control**: Enable/disable any feature or the entire extension
- **Deletion**: Remove extension to delete all local data
- **Export**: Back up your settings (coming in future versions)

## 🛠️ **Permissions Explained**

We request these permissions for legitimate functionality:

- **`<all_urls>`**: Required to scan content and enforce safe search on all websites
- **`storage`**: Store your settings locally on your device
- **`declarativeNetRequest`**: Block inappropriate websites
- **`scripting`**: Inject content filtering scripts
- **`tabs`**: Manage blocked page redirections

## 📱 **Children's Privacy**

This extension is designed to protect users of all ages, including children. We:

- ✅ Do not collect personal information from anyone, including children
- ✅ Process all content filtering locally on the device
- ✅ Provide parental controls via PIN protection

## 🔄 **Data Retention**

- **Settings**: Kept until you uninstall the extension
- **Cached Verses**: Automatically cleared after 7 days
- **Statistics**: Reset weekly (if enabled)
- **Logs**: Kept for maximum 100 entries, automatically pruned

## 📧 **Contact Us**

For privacy questions or concerns:

- **Email**: [INSERT YOUR EMAIL]
- **Website**: [INSERT YOUR WEBSITE]
- **GitHub**: [INSERT GITHUB REPO URL]

## 🔄 **Updates to This Policy**

We may update this policy occasionally. Changes will be:

- Posted with a new effective date
- Highlighted in extension update notes
- Applied only to future data collection

## 🌟 **Our Promise**

We built Armor of God to help Christians maintain purity online while respecting their privacy. We will never monetize your data, track your browsing, or compromise your privacy for any reason.

---

**"Above all else, guard your heart, for everything you do flows from it."** - Proverbs 4:23 (BSB)

---

## 📋 **For Store Submissions**

### **Chrome Web Store**

This privacy policy satisfies Chrome Web Store requirements for extensions with:

- Host permissions
- Content script injection
- Data storage
- External API communication

### **Firefox Add-ons**

Complies with AMO privacy requirements for:

- WebRequest permissions (Firefox version)
- Local storage usage
- Third-party service communication

### **Legal Compliance**

- ✅ GDPR compliant (EU users)
- ✅ CCPA compliant (California users)
- ✅ COPPA compliant (children's privacy)
- ✅ No tracking or analytics by default
