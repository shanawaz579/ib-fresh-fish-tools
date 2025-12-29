# Mobile App Setup Guide

This guide will help you set up and run the IB Fresh Fish Tools mobile app.

## What Was Created

A React Native mobile app that shares the backend (Supabase) with your existing web application. The app includes:

1. **Home Screen** - Navigation dashboard
2. **Purchase Bill Screen** - Record fish purchases from farmers
3. **Sales Spreadsheet Screen** - Record daily sales to customers
4. **Shared API Layer** - Common code between web and mobile

## Project Structure

```
ib-fresh-fish-tools/
├── mobile/                    # React Native app
│   ├── src/
│   │   ├── screens/          # Purchase, Sales, Home screens
│   │   ├── navigation/       # App navigation
│   │   └── config/           # Supabase config
│   ├── App.tsx
│   ├── package.json
│   └── .env                  # Environment variables
│
├── shared/                    # Shared between web and mobile
│   ├── api/                  # Supabase API functions
│   │   └── stock.ts          # Purchase/Sales operations
│   ├── types/                # TypeScript types
│   │   └── index.ts          # Shared type definitions
│   └── lib/                  # Shared libraries
│       └── supabase.ts       # Supabase client
│
└── app/                      # Next.js web app (existing)
```

## Quick Start

### Step 1: Configure Environment Variables

The mobile app needs your Supabase credentials.

1. Find your Supabase credentials in `/.env.local`
2. Copy them to the mobile app's environment file

```bash
# In the project root
cd mobile
```

Edit the `.env` file and replace with your actual values:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 2: Run the Mobile App

```bash
# Make sure you're in the mobile directory
cd mobile

# Start the development server
npm start
```

This will open Expo DevTools in your browser and show a QR code.

### Step 3: Test on Your Device

#### Option A: Test on Physical Device (Easiest)

1. **Install Expo Go** on your phone:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Scan the QR Code**:
   - iOS: Use Camera app
   - Android: Use Expo Go app

#### Option B: Test on Simulator/Emulator

**iOS Simulator (Mac only):**
```bash
npm run ios
```

**Android Emulator:**
```bash
npm run android
```

## Features

### Purchase Bill Screen
- Select farmer from dropdown
- Select fish variety
- Enter quantity (crates and kg)
- View purchases grouped by farmer
- Delete purchases
- Navigate between dates

### Sales Spreadsheet Screen
- Select customer from dropdown
- Select fish variety
- Enter quantity (crates and kg)
- View stock availability
- View sales grouped by customer
- Delete sales
- Navigate between dates

## Development Workflow

### Making Changes

1. Edit files in `mobile/src/`
2. Save the file
3. App will reload automatically
4. Changes appear instantly

### Adding New Features

The shared API layer in `/shared` can be used by both web and mobile:

```typescript
// In any screen
import { getFishVarieties, addPurchase } from '../../../shared/api/stock';

// Use the functions
const varieties = await getFishVarieties();
const result = await addPurchase(farmerId, varietyId, crates, kg, date);
```

## Building for Production

### Prerequisites

Install Expo EAS CLI:
```bash
npm install -g eas-cli
```

Login to Expo:
```bash
eas login
```

### iOS Build

```bash
cd mobile
eas build --platform ios
```

### Android Build

```bash
cd mobile
eas build --platform android
```

The builds will be uploaded to Expo and you'll get a download link.

## Troubleshooting

### "Cannot connect to development server"
- Make sure your phone and computer are on the same WiFi network
- Try restarting the development server: `npm start -c` (clears cache)

### "Missing Supabase configuration"
- Check that `.env` file exists in `mobile/` directory
- Verify the environment variables are correct
- Restart the development server

### "Module not found" errors
- Run `npm install` in the mobile directory
- Clear cache: `npm start -c`

### App crashes on startup
- Check the terminal for error messages
- Make sure all dependencies are installed
- Try deleting `node_modules` and running `npm install` again

## Next Steps

### Recommended Enhancements

1. **Authentication**
   - Add login/signup screens
   - Implement Supabase Auth
   - Protect routes with authentication

2. **Bill Generation**
   - Generate PDF bills
   - Share via WhatsApp
   - Print bills

3. **Offline Mode**
   - Store data locally
   - Sync when online
   - Show offline indicator

4. **Push Notifications**
   - Low stock alerts
   - Payment reminders
   - Daily summaries

5. **Advanced Features**
   - Dashboard with charts
   - Search and filters
   - Export to Excel
   - Camera for receipts

## Resources

- **Mobile App README**: `mobile/README.md` - Detailed documentation
- **Expo Docs**: https://docs.expo.dev/
- **React Native**: https://reactnavative.dev/
- **Supabase**: https://supabase.com/docs

## Support

If you encounter any issues:

1. Check the terminal for error messages
2. Check browser console (for Expo DevTools)
3. Review the troubleshooting section above
4. Check Expo documentation

## Summary

You now have:

✅ A fully functional React Native mobile app
✅ Shared code layer between web and mobile
✅ Purchase and Sales screens
✅ Real-time sync with Supabase
✅ Ready for iOS and Android

The app is ready to test! Start with `npm start` in the mobile directory and scan the QR code with Expo Go.
