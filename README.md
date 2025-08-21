# Armor of God - Christian Safety Browser Extension

> **Walking in faith, browsing with protection**

A comprehensive cross-browser extension that provides Christian-focused content filtering, safe search enforcement, and daily Berean Standard Bible verses to help maintain a pure and edifying online experience.

## 🛡️ Features

### Content Protection

- **AI-Powered Image Filtering** - Uses TensorFlow.js and NSFWJS to detect and blur inappropriate images
- **URL Blocking** - Blocks access to known inappropriate websites with gentle redirection
- **Safe Search Enforcement** - Automatically enforces safe search on Google, Bing, DuckDuckGo, and YouTube
- **Video Content Scanning** (v1.0) - Analyzes video content for inappropriate material
- **Customizable Sensitivity** - Adjustable thresholds for different protection levels

### Spiritual Enrichment

- **Daily BSB Verses** - Displays a curated verse from the Berean Standard Bible each day
- **Gentle Blocking Experience** - Blocked content pages include encouraging Scripture
- **Christian Alternative Resources** - Suggests faith-based alternatives when content is blocked

### Privacy & Security

- **Local Processing** - All content scanning happens on-device, nothing leaves your browser
- **Secure API Proxy** - Bible verses fetched through secure serverless worker
- **PIN Protection** - Admin controls protected by cryptographically hashed PIN
- **Zero Telemetry** - No browsing history collected or transmitted

### Cross-Platform

- **Chrome/Edge/Arc** - Full Manifest V3 support with Declarative Net Request
- **Firefox** - Compatible with webRequest API fallback
- **Safari** - Native app wrapper for macOS and iOS distribution

## 📦 Project Structure

```
armor-of-god/
├── packages/
│   └── shared/                 # Shared types and constants
├── apps/
│   ├── extension/              # Main browser extension
│   │   ├── src/
│   │   │   ├── background/     # Service worker & rules engine
│   │   │   ├── content/        # Content scripts & ML filtering
│   │   │   ├── ui/            # React components (popup, options, blocked)
│   │   │   ├── lib/           # Utilities (storage, crypto, logging)
│   │   │   └── data/          # Initial rules & verse plan
│   │   └── tests/             # Playwright test suite
│   ├── worker/                # Cloudflare Worker for BSB API proxy
│   └── safari-wrapper/        # Safari app container setup
└── package.json              # Monorepo configuration
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Modern browser (Chrome 88+, Firefox 109+, Safari 14+)

### Installation

1. **Clone and Setup**

   ```bash
   git clone <repository-url>
   cd "Armor of God"
   pnpm install
   ```

2. **Build Extension**

   ```bash
   cd apps/extension
   pnpm build
   ```

3. **Deploy Worker** (Optional - for live verse fetching)

   ```bash
   cd apps/worker
   wrangler secret put SCRIPTURE_API_KEY
   pnpm deploy
   ```

4. **Load Extension**
   - **Chrome**: Navigate to `chrome://extensions`, enable Developer Mode, click "Load unpacked", select `apps/extension/dist`
   - **Firefox**: Navigate to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", select `manifest.json`
   - **Safari**: Follow instructions in `apps/safari-wrapper/README.md`

## 🔧 Development

### Available Commands

```bash
# Root level
pnpm build          # Build all packages
pnpm test           # Run all tests
pnpm dev            # Start development mode

# Extension development
cd apps/extension
pnpm dev            # Development server
pnpm build          # Production build
pnpm build:firefox  # Firefox-specific build
pnpm test:e2e       # End-to-end tests

# Worker development
cd apps/worker
pnpm dev           # Local development server
pnpm deploy        # Deploy to Cloudflare
```

### Testing

Comprehensive test suite with Playwright:

```bash
cd apps/extension
pnpm test:e2e           # Full test suite
pnpm test:e2e:headed    # With browser visible
pnpm test:e2e:debug     # Debug mode
```

Tests cover:

- Extension loading and initialization
- Background service worker functionality
- Content filtering and ML processing
- UI component interaction
- Safe search enforcement
- Cross-browser compatibility

## 🎯 Architecture

### Core Components

1. **Background Service Worker** (`src/background/`)
   - Manages declarative net request rules
   - Handles safe search enforcement
   - Coordinates scheduled tasks and verse fetching
   - Provides settings and statistics API

2. **Content Scripts** (`src/content/`)
   - Scans images using NSFWJS ML model
   - Applies blur/warning/blocking effects
   - Monitors video content (v1.0)
   - Injects React overlays for user interaction

3. **React UI** (`src/ui/`)
   - **Popup**: Daily verse, quick stats, toggle controls
   - **Options**: Comprehensive settings management
   - **Blocked**: Gentle blocking page with Scripture

4. **Cloudflare Worker** (`apps/worker/`)
   - Secures Bible API key server-side
   - Provides caching and rate limiting
   - Serves daily verses and passage requests

### Browser Compatibility

- **Chrome/Edge/Arc**: Uses Manifest V3 with Declarative Net Request API
- **Firefox**: Falls back to webRequest API with blocking listeners
- **Safari**: Native app wrapper with web extension integration

## 📖 Bible Integration

### Berean Standard Bible (BSB)

- **Version ID**: `bba9f40183526463-01`
- **365 Curated Verses**: Meaningful daily Scripture rotation
- **Secure Proxy**: API key protected server-side
- **Offline Fallback**: Grace degradation when API unavailable
- **Proper Attribution**: Compliant copyright notices

### Verse Display

- Daily verse in popup and blocked pages
- Contextually appropriate Scripture for different situations
- Beautiful typography with proper citation format

## 🔐 Security & Privacy

### Data Protection

- **No Tracking**: Zero browsing history collection
- **Local Processing**: All content scanning on-device
- **Anonymous Statistics**: Optional aggregated metrics only
- **Secure PIN**: PBKDF2 with SHA-256 hashing

### API Security

- Scripture API key stored only in Cloudflare Worker
- CORS restrictions to extension origins only
- Rate limiting and request validation
- No sensitive data in extension code

### Content Security

- Sandboxed content scripts
- CSP headers on all extension pages
- Minimal permissions required
- Regular security audits

## 🎨 UI/UX Design

### Design Principles

- **Gentle & Encouraging**: Non-judgmental approach to content filtering
- **Scripture-Centered**: Bible verses integrated throughout experience
- **Clean & Modern**: Professional interface with Christian aesthetics
- **Accessible**: ARIA labels, keyboard navigation, reduced motion support

### Responsive Design

- Popup optimized for various browser window sizes
- Options page adapts to different screen sizes
- Mobile-friendly blocked page for Safari iOS

## 🧪 Quality Assurance

### Testing Strategy

- **Unit Tests**: Core utilities and business logic
- **Integration Tests**: Extension API interactions
- **End-to-End Tests**: Full user workflows across browsers
- **Accessibility Tests**: Screen reader and keyboard compatibility
- **Performance Tests**: ML model loading and content processing

### Code Quality

- TypeScript for type safety
- ESLint for code consistency
- Prettier for formatting
- Comprehensive error handling
- Extensive logging with privacy respect

## 📱 Distribution

### Browser Stores

- **Chrome Web Store**: Manifest V3 compliant
- **Firefox Add-ons**: webRequest API integration
- **Edge Add-ons**: Chrome Web Store compatibility
- **Safari App Store**: Native app wrapper required

### Enterprise Deployment

- Managed policies support for organizations
- Bulk configuration options
- Admin dashboard compatibility
- Group Policy integration (Windows)

## 🔮 Roadmap

### v1.0 Features

- ✅ Image content filtering with ML
- ✅ Safe search enforcement
- ✅ Daily BSB verses
- ✅ Comprehensive settings
- ✅ Cross-browser support
- 🔲 Video content analysis
- 🔲 Text content filtering
- 🔲 Schedule-based restrictions
- 🔲 Advanced admin controls

### Future Enhancements

- Cloud sync for settings across devices
- Parent/teacher dashboard
- Content reporting and analytics
- Custom verse collections
- Integration with Christian resources
- Mobile app companion

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create feature branch
3. Follow TypeScript and React best practices
4. Add tests for new functionality
5. Ensure cross-browser compatibility
6. Submit pull request with clear description

### Guidelines

- Maintain Christian values in all features
- Prioritize user privacy and security
- Write comprehensive tests
- Document API changes
- Follow semantic versioning

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Berean Standard Bible** - Scripture text used by permission
- **NSFWJS** - Open source content classification model
- **TensorFlow.js** - Machine learning in the browser
- **React** - User interface framework
- **Playwright** - End-to-end testing framework
- **Cloudflare Workers** - Serverless API hosting

## 📞 Support

- **Documentation**: See individual README files in each app directory
- **Issues**: Report bugs and request features via GitHub Issues
- **Community**: Join discussions in GitHub Discussions
- **Privacy**: Read our privacy policy in the extension options

---

_"Finally, be strong in the Lord and in his mighty power. Put on the full armor of God, so that you can take your stand against the devil's schemes."_ - Ephesians 6:10-11 (BSB)

**Built with ♥️ for the Christian community**
