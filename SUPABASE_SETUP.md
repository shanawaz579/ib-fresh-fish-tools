# Fresh Fish Tools - Supabase Setup Guide

## Step 1: Access Supabase SQL Editor

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Sign in and select your project: **bcitmhfdcgkifptycqdh**
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

## Step 2: Create Database Tables

Copy the entire SQL from `DATABASE_SETUP.sql` file in this project and paste it into the SQL editor.

The SQL creates:
- **fish_varieties** - List of fish types (Tilapia, Catfish, etc.)
- **purchases** - Track fish bought from farmers daily
- **sales** - Track fish sold to customers daily

Click **Run** to execute the SQL.

## Step 3: Verify Tables Were Created

After running the SQL:
1. Go to **Table Editor** in the left sidebar
2. You should see three tables:
   - `fish_varieties` (with 8 sample fish types pre-populated)
   - `purchases` (empty, ready for data)
   - `sales` (empty, ready for data)

## Step 4: Verify Environment Variables

Check that your `.env.local` file has:
```
SUPABASE_URL=https://bcitmhfdcgkifptycqdh.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaXRtaGZkY2draWZwdHljcWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDYxMDQsImV4cCI6MjA3ODc4MjEwNH0.qIFasVjpaxFFk2zeJ1bXVCYYDflH-lMAQKlhkmodyc8
```

## Step 5: Start Your Dev Server

```bash
npm run dev
```

## Step 6: Test the Application

1. Navigate to `http://localhost:3000/tools/purchases`
   - Try adding a purchase entry
   - Select a farmer name, fish type, quantity
   
2. Navigate to `http://localhost:3000/tools/sales`
   - Try adding a sales entry
   - Select a customer name, fish type, quantity

## Table Structure

### fish_varieties
- `id` - Unique identifier
- `name` - Fish type name (Tilapia, Catfish, etc.)
- `created_at` - Timestamp

### purchases
- `id` - Unique identifier
- `farmer_name` - Name of the farmer
- `fish_variety_id` - Reference to fish_varieties table
- `quantity_crates` - Number of crates purchased
- `quantity_kg` - Weight in kilograms
- `purchase_date` - Date of purchase (defaults to today)
- `created_at` - Record creation timestamp
- `updated_at` - Last update timestamp

### sales
- `id` - Unique identifier
- `customer_name` - Name of the customer
- `fish_variety_id` - Reference to fish_varieties table
- `quantity_crates` - Number of crates sold
- `quantity_kg` - Weight in kilograms
- `sale_date` - Date of sale (defaults to today)
- `created_at` - Record creation timestamp
- `updated_at` - Last update timestamp

## Troubleshooting

**Error: "Could not find the table"**
- Make sure you ran the SQL in Supabase SQL Editor
- Verify the table names in SQL Editor match what the app expects

**Error: "Missing environment variables"**
- Check `.env.local` has the correct SUPABASE_URL and SUPABASE_KEY
- Restart your dev server after updating `.env.local`

**No data showing in tables**
- Make sure to add some data using the forms first
- The tables start empty
