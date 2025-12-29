# Quick Start - Mobile App

Get your mobile app running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd mobile
npm install
```

## Step 2: Start the App

```bash
npm start
```

This will:
- Start the Expo development server
- Open Expo DevTools in your browser
- Show a QR code in the terminal

## Step 3: Test on Your Phone

### Install Expo Go

- **iPhone**: [Download from App Store](https://apps.apple.com/app/expo-go/id982107779)
- **Android**: [Download from Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

### Scan QR Code

- **iPhone**: Open Camera app, point at QR code, tap notification
- **Android**: Open Expo Go app, tap "Scan QR Code"

The app will load on your phone!

## What You'll See

1. **Home Screen** - Two cards:
   - 🛒 Purchase Bill
   - 📊 Sales Spreadsheet

2. **Purchase Screen** - Record purchases from farmers
   - Select farmer
   - Select fish type
   - Enter crates and kg
   - View all purchases grouped by farmer

3. **Sales Screen** - Record sales to customers
   - View stock availability
   - Select customer
   - Select fish type
   - Enter crates and kg
   - View all sales grouped by customer

## Testing on Simulator/Emulator

### iOS Simulator (Mac only)

```bash
npm run ios
```

### Android Emulator

```bash
npm run android
```

## Common Commands

```bash
# Start development server
npm start

# Start with cache cleared
npm start -c

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web browser (for testing)
npm run web
```

## Making Changes

1. Edit any file in `mobile/src/`
2. Save the file
3. The app reloads automatically
4. Changes appear instantly on your device

## Keyboard Shortcuts

While the dev server is running:

- `r` - Reload the app
- `m` - Toggle menu
- `d` - Open developer menu
- `i` - Run on iOS simulator
- `a` - Run on Android emulator
- `w` - Run on web

## Troubleshooting

### Can't connect?
- Make sure your phone and computer are on the same WiFi
- Try restarting: `npm start -c`

### App crashes?
- Check terminal for errors
- Try: `rm -rf node_modules && npm install`

### Need help?
- Check `MOBILE_APP_SETUP.md` for detailed guide
- Check `mobile/README.md` for full documentation

## Next Steps

Once the app is running:

1. Try recording a purchase
2. Try recording a sale
3. Check that data syncs with your web app
4. Navigate between different dates
5. Test on different devices

## File Structure

```
mobile/
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx       # Home dashboard
│   │   ├── PurchaseScreen.tsx   # Purchase recording
│   │   └── SalesScreen.tsx      # Sales recording
│   └── navigation/
│       └── AppNavigator.tsx     # App navigation
└── App.tsx                      # Entry point
```

## Environment Variables

Already configured in `mobile/.env`:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase key

These are automatically loaded by Expo.

## That's It!

Your mobile app is ready to use. Start with `npm start` and scan the QR code!

For more details, see `MOBILE_APP_SETUP.md`.
