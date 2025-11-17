# Deployment Instructions

## Step 1: Update Supabase Database Schema

The application has been refactored to use a normalized database structure with `farmers` and `customers` tables. You must run the SQL migration in your Supabase project.

### Instructions:

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to the **SQL Editor** section
3. Click **New Query** or **+ Create a new query**
4. Copy the entire contents of `DATABASE_SETUP.sql` file in this repository
5. Paste it into the SQL editor
6. Click **Run** to execute the migration
7. Wait for confirmation that all queries executed successfully

**Note**: This will:
- Create `farmers` table with sample data
- Create `customers` table with sample data
- Create `purchases` table with foreign key to `farmers`
- Create `sales` table with foreign key to `customers`
- Set up Row Level Security (RLS) policies
- Create performance indexes
- Insert sample fish varieties

## Step 2: Verify Environment Variables

Ensure your `.env.local` file contains:

```
SUPABASE_URL=https://bcitmhfdcgkifptycqdh.supabase.co
SUPABASE_KEY=your_supabase_key_here
```

Both values are already configured in your project.

## Step 3: Test the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000 in your browser

3. Test the workflow:

   **Purchase Records Page:**
   - Go to Tools > Purchases
   - Select a date
   - Click on the Farmer dropdown and select a farmer (e.g., "Farmer Ahmad")
   - Select a Fish Type (e.g., "Tilapia Big")
   - Enter quantities (Crates and/or Kg)
   - Click "Add Item"
   - You should see items listed in the preview
   - Click "Save All" to save purchases
   - Verify items appear in the table grouped by farmer
   - Test Edit: Click Edit on an item, modify values, click Save
   - Test Delete: Click Delete on an item, confirm deletion

   **Sales Records Page:**
   - Go to Tools > Sales
   - Repeat the same process but with Customers instead of Farmers
   - Verify the workflow matches the Purchases page

## Step 4: Features Now Available

✅ **Searchable Farmer/Customer Dropdowns**
- Farmers and customers are now loaded from the database
- Smooth searchable dropdown for quick selection
- No more free-text entry with inconsistent naming

✅ **Database Normalization**
- All farmers stored in `farmers` table
- All customers stored in `customers` table
- Prevents duplicate/similar entries (e.g., "Ahmad" vs "ahmad")

✅ **Fully Functional Edit**
- Edit any purchase or sale record
- Modify farmer/customer, fish variety, and quantities
- Changes saved correctly to database

✅ **Type-Safe Operations**
- All operations properly typed with TypeScript
- No more "Cannot read property of undefined" errors
- Consistent data structure throughout the application

## Step 5: Adding New Farmers/Customers

Currently, farmers and customers are manually added. To add more:

1. Go to Supabase SQL Editor
2. Run:
   ```sql
   INSERT INTO public.farmers (name) VALUES ('New Farmer Name');
   INSERT INTO public.customers (name) VALUES ('New Customer Name');
   ```
3. Refresh the application - the new entries will appear in the dropdowns

**Future Enhancement**: Add UI forms to add new farmers/customers directly from the application.

## Troubleshooting

### Error: "farmer_id" column not found
**Cause**: Database schema not yet updated
**Solution**: Run Step 1 (DATABASE_SETUP.sql) in Supabase

### Dropdowns showing "No options"
**Cause**: Database query failing
**Solution**: 
- Check browser console for error messages
- Verify SUPABASE_URL and SUPABASE_KEY in .env.local are correct
- Ensure RLS policies were created (check Supabase dashboard)

### Edit/Update failing
**Cause**: May be type mismatch if old schema still in use
**Solution**: Run DATABASE_SETUP.sql again or clear old tables and re-run

## Next Steps

1. Deploy to production (Vercel recommended)
2. Add authentication if needed
3. Add UI forms to manage farmers and customers directly
4. Add reporting/analytics views
5. Add export to Excel/PDF functionality
