# Project Structure - Web + Mobile

## Complete Directory Tree

```
ib-fresh-fish-tools/
│
├── 📱 mobile/                          # React Native Mobile App
│   ├── src/
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx          # 🏠 Home dashboard
│   │   │   ├── PurchaseScreen.tsx      # 🛒 Purchase recording
│   │   │   └── SalesScreen.tsx         # 📊 Sales recording
│   │   ├── navigation/
│   │   │   └── AppNavigator.tsx        # 🧭 Navigation setup
│   │   ├── components/                 # 🧩 Reusable components (empty for now)
│   │   └── config/
│   │       └── supabase.ts             # ⚙️ Supabase config
│   ├── App.tsx                         # 🚀 Entry point
│   ├── package.json
│   ├── .env                            # 🔑 Environment variables
│   └── README.md                       # 📖 Mobile documentation
│
├── 🔄 shared/                          # Shared Code (NEW!)
│   ├── api/
│   │   └── stock.ts                    # 📡 All Supabase operations
│   ├── types/
│   │   └── index.ts                    # 📝 TypeScript types
│   └── lib/
│       └── supabase.ts                 # 🔌 Supabase client
│
├── 🌐 app/                             # Next.js Web App (existing)
│   ├── tools/
│   │   ├── purchases/
│   │   │   └── page.tsx                # 🛒 Purchase page
│   │   └── sales-spreadsheet/
│   │       └── page.tsx                # 📊 Sales page
│   └── actions/
│       ├── stock.ts                    # (can be refactored to use shared/)
│       └── bills.ts
│
├── 📚 Documentation
│   ├── QUICK_START_MOBILE.md           # ⚡ 5-minute quick start
│   ├── MOBILE_APP_SETUP.md             # 📖 Complete setup guide
│   ├── MOBILE_APP_SUMMARY.md           # 📊 What was built
│   └── PROJECT_STRUCTURE.md            # 🗂️ This file
│
└── ⚙️ Config Files
    ├── .env.local                      # Web environment variables
    ├── package.json                    # Web dependencies
    └── tsconfig.json                   # TypeScript config
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  📱 MOBILE APP                    🌐 WEB APP               │
│  (React Native)                   (Next.js)                │
│                                                             │
│  ┌──────────────┐                 ┌──────────────┐        │
│  │ Purchase     │                 │ Purchase     │        │
│  │ Screen       │                 │ Page         │        │
│  └──────┬───────┘                 └──────┬───────┘        │
│         │                                │                 │
│         │                                │                 │
│  ┌──────┴───────┐                 ┌─────┴────────┐        │
│  │ Sales        │                 │ Sales        │        │
│  │ Screen       │                 │ Page         │        │
│  └──────┬───────┘                 └──────┬───────┘        │
│         │                                │                 │
│         └────────────┬───────────────────┘                 │
│                      │                                     │
│                      ▼                                     │
│         ┌────────────────────────┐                        │
│         │  🔄 SHARED API LAYER   │                        │
│         │  (shared/api/stock.ts) │                        │
│         └────────────┬───────────┘                        │
│                      │                                     │
│                      ▼                                     │
│         ┌────────────────────────┐                        │
│         │  🔌 SUPABASE CLIENT    │                        │
│         │  (shared/lib)          │                        │
│         └────────────┬───────────┘                        │
│                      │                                     │
└──────────────────────┼─────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   ☁️ SUPABASE  │
              │   DATABASE     │
              └────────────────┘
```

## Key Concepts

### 1. Shared Code (`/shared`)

**Purpose**: Code used by BOTH web and mobile apps

**Benefits**:
- ✅ Write once, use everywhere
- ✅ Consistent data handling
- ✅ Easy maintenance
- ✅ Single source of truth

**What's Shared**:
- API functions (getFishVarieties, addPurchase, etc.)
- TypeScript types (Purchase, Sale, Customer, etc.)
- Supabase client configuration

### 2. Mobile App (`/mobile`)

**Purpose**: React Native app for iOS and Android

**Technology**:
- React Native
- Expo
- React Navigation
- TypeScript

**Screens**:
1. Home - Navigation dashboard
2. Purchase - Record purchases
3. Sales - Record sales

### 3. Web App (`/app`)

**Purpose**: Next.js web application

**Technology**:
- Next.js 16
- React 19
- Tailwind CSS
- TypeScript

**Features**:
- Purchase management
- Sales spreadsheet
- Bill generation
- Reports and analytics

## File Responsibilities

### Mobile App Files

| File | Purpose | Size |
|------|---------|------|
| `HomeScreen.tsx` | Navigation dashboard | ~150 lines |
| `PurchaseScreen.tsx` | Purchase recording | ~400 lines |
| `SalesScreen.tsx` | Sales recording | ~500 lines |
| `AppNavigator.tsx` | Navigation setup | ~30 lines |
| `App.tsx` | Entry point | ~5 lines |

### Shared Files

| File | Purpose | Size |
|------|---------|------|
| `stock.ts` | All database operations | ~400 lines |
| `types/index.ts` | Type definitions | ~80 lines |
| `lib/supabase.ts` | Client configuration | ~20 lines |

## Environment Variables

### Web App (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
```

### Mobile App (`mobile/.env`)
```
EXPO_PUBLIC_SUPABASE_URL=https://...
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Note**: Mobile uses `EXPO_PUBLIC_` prefix instead of `NEXT_PUBLIC_`

## Dependencies

### Mobile App
- `@supabase/supabase-js` - Database client
- `@react-navigation/native` - Navigation
- `@react-native-picker/picker` - Dropdown picker
- `expo` - Development platform

### Shared
- No dependencies (uses platform-specific Supabase client)

### Web App
- `next` - Framework
- `react` - UI library
- `@supabase/supabase-js` - Database client
- `tailwindcss` - Styling

## Development Workflow

### Working on Mobile

```bash
cd mobile
npm start
```

### Working on Web

```bash
npm run dev
```

### Updating Shared Code

Changes to `/shared` affect both apps:

1. Edit file in `/shared`
2. Test web app: `npm run dev`
3. Test mobile app: `cd mobile && npm start`
4. Verify both work correctly

## Quick Commands

### Mobile
```bash
cd mobile
npm start          # Start dev server
npm run ios        # Run on iOS
npm run android    # Run on Android
npm install        # Install dependencies
```

### Web
```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm install        # Install dependencies
```

## Important Notes

1. **Never commit `.env` files** (already in .gitignore)
2. **Test both platforms** when changing shared code
3. **Use TypeScript types** for better code safety
4. **Follow existing patterns** for consistency

## Next Steps

1. ✅ Mobile app is ready to test
2. 📱 Install Expo Go on your phone
3. 🚀 Run `cd mobile && npm start`
4. 📸 Scan QR code to launch app
5. 🎉 Start using the app!

See `QUICK_START_MOBILE.md` for detailed instructions.
