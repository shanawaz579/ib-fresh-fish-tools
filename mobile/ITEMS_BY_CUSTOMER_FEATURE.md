# Items by Customer Screen

## Overview
New screen that shows which customers bought each fish variety on a specific date. This view helps answer the question: "Who bought this fish?"

## Features

### 1. Fish Variety Cards
- Each card represents one type of fish sold that day
- Shows fish name with S/M/B size badge
- Displays total quantity sold
- Shows number of customers who bought it

### 2. Customer List per Item
- Expandable/collapsible customer list
- Shows customer name and quantity purchased
- Clear display of crates and kg

### 3. Date Navigation
- Date picker with Previous/Next day buttons
- "Today" quick access button
- Pull-to-refresh to reload data

### 4. Clean UI
- Matches Dashboard design style
- Size badges (Blue=B, Yellow=M, Green=S)
- Expandable cards with smooth transitions
- Empty state when no sales

## UI Example

```
Items by Customer
Date: [26 Dec 2025] [←] [→] [Today]

┌─────────────────────────────────────┐
│ Pangasius [M]      ▼                │
│ 3 customers          43 crates      │
├─────────────────────────────────────┤
│ → CP VANAGARAM           27 crates  │
│ → ABC Traders            10 crates  │
│ → XYZ Fish Market         6 crates  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Rohu [B]           ▶                │
│ 2 customers          15 crates      │
└─────────────────────────────────────┘
```

## Access
- **Admin only** - Available from Home screen
- Menu item: "📋 Items by Customer"
- Located after "Packing List" on Home screen

## Technical Details

### Files Created/Modified

**New File:**
- `src/screens/ItemsByCustomerScreen.tsx` - Main screen component

**Modified Files:**
- `src/navigation/AppNavigator.tsx` - Added route
- `src/screens/HomeScreen.tsx` - Added menu item

### Data Flow
1. Fetches sales data using `getSalesByDate(date)`
2. Groups sales by `fish_variety_id`
3. For each variety, aggregates:
   - Total crates sold
   - Total kg sold
   - List of customers with quantities

### Sorting
- Fish varieties sorted alphabetically by name
- Customers shown in order they appear in sales

### State Management
- Expandable state tracked in Set<number>
- Default: all cards collapsed
- Click to expand/collapse individual items

## Use Cases

1. **Delivery Planning**
   - "Which customers need Pangasius Medium delivery?"
   - Quick view of distribution per item

2. **Inventory Check**
   - "Was Rohu Big sold? To whom?"
   - Verify specific item sales

3. **Customer Service**
   - "Did Customer X get their Katla?"
   - Cross-reference customer orders

4. **Business Analytics**
   - "How many customers bought each variety?"
   - Distribution patterns analysis

## Future Enhancements (Optional)

- [ ] Sort customers by quantity (highest first)
- [ ] Filter by fish variety
- [ ] Search for specific customer
- [ ] Export to PDF/Excel
- [ ] Show prices/amounts
- [ ] Date range instead of single date

## Testing

To test the new screen:
1. Login as admin (shanawaz579@gmail.com)
2. Tap "Items by Customer" from Home screen
3. Select different dates to see sales
4. Tap fish cards to expand/collapse
5. Pull down to refresh
6. Verify data matches Sales Spreadsheet

## Color Scheme
- Header: Blue (#3B82F6)
- Card border: Indigo (#6366F1)
- Size badges: Blue/Yellow/Green (same as Dashboard)
- Totals: Blue (#3B82F6)
