# IB Fresh Fish Tools - Mobile App

React Native mobile application for managing fish trading operations, including purchases and sales.

## Features

- **Purchase Bill**: Record fish purchases from farmers
- **Sales Spreadsheet**: Quick entry for daily sales records
- **Real-time Sync**: Shared Supabase backend with web app
- **Offline Support**: Works offline and syncs when connected

## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Expo CLI
- iOS Simulator (Mac only) or Android Emulator

## Setup Instructions

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure Environment Variables

Copy the Supabase credentials from your web app's `.env.local` file:

Edit `mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run the App

**iOS (Mac only):**
```bash
npm run ios
```

**Android:**
```bash
npm run android
```

**Web (for testing):**
```bash
npm run web
```

**Development Server:**
```bash
npm start
```

Then scan the QR code with:
- **iOS**: Camera app (iOS 11+) or Expo Go app
- **Android**: Expo Go app

## Project Structure

```
mobile/
├── src/
│   ├── screens/          # App screens
│   │   ├── HomeScreen.tsx
│   │   ├── PurchaseScreen.tsx
│   │   └── SalesScreen.tsx
│   ├── navigation/       # Navigation setup
│   │   └── AppNavigator.tsx
│   ├── components/       # Reusable components
│   └── config/          # Configuration
│       └── supabase.ts  # Supabase client
├── App.tsx              # Root component
└── package.json

shared/                  # Shared code with web app
├── api/                # Supabase API functions
│   └── stock.ts
├── types/              # TypeScript types
│   └── index.ts
└── lib/               # Shared libraries
    └── supabase.ts    # Supabase client
```

## Building for Production

### iOS

1. **Configure app.json** with your bundle identifier
2. **Build**:
   ```bash
   eas build --platform ios
   ```
3. **Submit to App Store**:
   ```bash
   eas submit --platform ios
   ```

### Android

1. **Configure app.json** with your package name
2. **Build**:
   ```bash
   eas build --platform android
   ```
3. **Submit to Google Play**:
   ```bash
   eas submit --platform android
   ```

## Development Tips

### Hot Reload
- Press `r` in the terminal to reload the app
- Shake your device to open the developer menu

### Debugging
- Use React Native Debugger
- Use Expo DevTools (opens in browser)
- Use console.log() - logs appear in terminal

### Testing on Physical Device
1. Install Expo Go app from App Store or Google Play
2. Run `npm start`
3. Scan the QR code with your device

## Common Issues

### "Missing Supabase configuration"
- Make sure you've created the `.env` file in the `mobile/` directory
- Ensure the environment variables are correct

### "Cannot connect to Supabase"
- Check your internet connection
- Verify Supabase URL and key are correct
- Check Supabase dashboard for service status

### Navigation not working
- Make sure all dependencies are installed
- Try clearing cache: `expo start -c`

## Next Steps

1. Add authentication (login/signup)
2. Add bill generation and printing
3. Add dashboard with analytics
4. Add push notifications
5. Add offline mode with local storage
6. Add camera for receipt scanning

## Resources

- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [React Navigation](https://reactnavigation.org/)
