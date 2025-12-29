# Android Input Field Visibility Fix

## Problem
In the installed Android app (APK), dropdown fields and text inputs in the "Add New Sale" section were not visible. The text appeared invisible/white on a light background. This issue only occurred in production builds, not in Expo Go.

## Root Cause
The input fields had a light gray background (`#F9FAFB`) without explicit text color specified. On Android production builds, the default text color can be white or very light, making it invisible against the light background.

## Solution
Changed all input fields to have:
1. **White background** (`#FFFFFF`) instead of light gray
2. **Explicit dark text color** (`#111827`)
3. **Dark dropdown icon color** for Picker components
4. **Color prop on Picker.Item** to ensure dropdown items are visible

## Changes Made in SalesScreen.tsx

### 1. Picker Styles (Dropdowns)
**Before:**
```javascript
picker: {
  backgroundColor: '#F9FAFB',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#D1D5DB',
},
```

**After:**
```javascript
picker: {
  backgroundColor: '#FFFFFF',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#D1D5DB',
  color: '#111827',
  paddingHorizontal: 12,
},
```

### 2. Picker Components
**Before:**
```javascript
<Picker style={styles.picker}>
  <Picker.Item label="Choose a customer..." value={null} />
  {customers.map((customer) => (
    <Picker.Item label={customer.name} value={customer.id} />
  ))}
</Picker>
```

**After:**
```javascript
<Picker style={styles.picker} dropdownIconColor="#111827">
  <Picker.Item label="Choose a customer..." value={null} color="#6B7280" />
  {customers.map((customer) => (
    <Picker.Item label={customer.name} value={customer.id} color="#111827" />
  ))}
</Picker>
```

### 3. Text Input Styles
**Before:**
```javascript
input: {
  backgroundColor: '#F9FAFB',
  borderWidth: 1,
  borderColor: '#D1D5DB',
  borderRadius: 8,
  padding: 12,
  fontSize: 16,
},
```

**After:**
```javascript
input: {
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#D1D5DB',
  borderRadius: 8,
  padding: 12,
  fontSize: 16,
  color: '#111827',
},
```

### 4. Edit Mode Inputs
Applied the same fixes to:
- `editPicker` style
- `editInput` style
- All Picker.Item components in edit mode

## What's Fixed
✅ Customer dropdown - now visible with dark text
✅ Fish type dropdown - now visible with dark text
✅ Crates input field - white background with dark text
✅ Kg input field - white background with dark text
✅ Edit mode dropdowns and inputs - all visible
✅ Dropdown icons - dark and visible

## Testing
After building a new APK:
1. Open the Sales Spreadsheet screen
2. Check "Add New Sale" section
3. All dropdowns should show dark text on white background
4. All input fields should show typed text clearly
5. Edit mode should also have visible inputs

## Why It Works
- White background provides contrast
- Explicit color props override Android defaults
- dropdownIconColor ensures the dropdown arrow is visible
- Picker.Item color prop ensures dropdown menu items are visible

This is a common Android issue where system defaults don't match expectations in production builds.
