# Marketing Hub Web UI - Quick Start

## 🚀 Start the Web Server

```bash
cd apps/frontend
npm run dev:web
```

**Access:** http://localhost:3000

---

## ✅ What Works in Web Mode

### Fully Functional Features
- ✅ All UI components and views
- ✅ Navigation (Home, Features, API Settings, Content Calendar, Kanban Board)
- ✅ Forms and inputs
- ✅ Internationalization (English/French)
- ✅ Theme switching
- ✅ Responsive design (desktop/tablet/mobile)
- ✅ All React components and interactions

### Limited/Mocked Features
- ⚠️ File system operations (browser sandbox)
- ⚠️ Terminal functionality (requires native PTY)
- ⚠️ Native dialogs (file/folder pickers)
- ⚠️ System tray integration
- ⚠️ App auto-updates

---

## 🧪 Testing Workflow

### 1. Start Development Server
```bash
cd apps/frontend
npm run dev:web
```

### 2. Open Browser
Navigate to http://localhost:3000

### 3. Hot Module Replacement (HMR)
- Edit any file in `apps/frontend/src/renderer/`
- Changes appear instantly without reload
- Fast iteration for UI/UX work

### 4. Test Different Viewports
- Use browser DevTools (F12)
- Test responsive breakpoints:
  - Desktop: 1920x1080
  - Tablet: 768x1024
  - Mobile: 375x667

---

## 🎨 UI/UX Development

### Key Files for Styling

```
apps/frontend/src/renderer/
├── features/           # Feature modules
│   ├── api-settings/   # API configuration UI
│   ├── brand-knowledge/  # Brand asset management
│   └── content-calendar/ # Campaign calendar
├── shared/
│   ├── components/     # Reusable UI components
│   └── i18n/locales/   # Translations (en/fr)
└── lib/
    └── browser-mock.ts # Web mode compatibility
```

### Tailwind CSS Configuration
- Config: `tailwind.config.js`
- PostCSS: `postcss.config.js`
- Custom styles in `src/renderer/styles/`

---

## 🌐 Browser DevTools

### Open DevTools
- **Windows/Linux:** `F12` or `Ctrl+Shift+I`
- **macOS:** `Cmd+Option+I`

### Useful Tools
- **Elements Tab:** Inspect HTML/CSS
- **Console Tab:** View logs and errors
- **Network Tab:** Monitor API calls
- **React DevTools:** Install Chrome extension for component inspection

---

## 📱 Responsive Testing

### Desktop First
```bash
# Default - Desktop view
http://localhost:3000
```

### Tablet/Mobile
Use Chrome DevTools Device Mode:
1. Open DevTools (F12)
2. Click device toolbar icon (Ctrl+Shift+M)
3. Select device from dropdown

### Viewport Sizes
- **Desktop:** 1280px+ (full features)
- **Tablet:** 768px - 1279px (adapted layout)
- **Mobile:** < 768px (stacked layout)

---

## 🐛 Debugging Tips

### Check Console Logs
```javascript
// In browser console (F12)
console.log('Debug info:', window.electronAPI)
```

### Network Monitoring
1. Open DevTools → Network tab
2. Filter by "Fetch" or "XHR"
3. Check API calls and responses

### React Component Debugging
Install React DevTools Chrome Extension:
- Search: "React Developer Tools"
- Install from Chrome Web Store
- Components tab appears in DevTools

---

## 🔧 Common Tasks

### Update Translation Strings
```bash
# Edit translation files
apps/frontend/src/shared/i18n/locales/en/common.json
apps/frontend/src/shared/i18n/locales/fr/common.json
```

### Modify Styling
```bash
# Tailwind classes in components
src/renderer/features/my-feature/MyComponent.tsx

# Custom CSS
src/renderer/styles/custom.css
```

### Add New Route
```bash
# Route configuration
src/renderer/router/routes.tsx
```

---

## 📊 Performance Monitoring

### Lighthouse Audit
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Run audit
4. Check Performance, Accessibility, Best Practices

### Bundle Size
```bash
# View bundle analyzer
npm run build -- --mode analyze
```

---

## 🚀 Production Build (Optional)

For static hosting deployment:
```bash
cd apps/frontend
npm run build:web
```

Output: `dist-web/` folder

---

## 📝 Notes

- **Hot Reload:** Enabled by default with Vite
- **TypeScript:** Full type checking enabled
- **Linting:** Run `npm run lint` to check code quality
- **Testing:** Run `npm run test` for unit tests
- **E2E Testing:** Run `npm run test:e2e:web` for Playwright tests

---

## 🔗 Related Documentation

- [UI_ACCESS_GUIDE.md](UI_ACCESS_GUIDE.md) - All UI access methods
- [PLAYWRIGHT_BROWSER_TESTING.md](PLAYWRIGHT_BROWSER_TESTING.md) - E2E testing setup
- [CLAUDE.md](CLAUDE.md) - Project documentation

---

**Status:** ✅ Web UI is live and ready for UI/UX development at **http://localhost:3000**
