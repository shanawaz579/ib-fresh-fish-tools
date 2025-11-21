# Authentication Setup Guide

## Steps to Enable Authentication

### 1. Enable Email Authentication in Supabase

1. Go to your Supabase project: https://app.supabase.com
2. Navigate to **Authentication** → **Providers**
3. Find **Email** and click the toggle to enable it
4. Set these options:
   - ✅ Enable email confirmations (optional but recommended)
   - Set email redirect URL to: `https://yourdomain.com/auth/callback`

### 2. Test Locally

1. Update your `.env.local` with these variables (you already have these):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://bcitmhfdcgkifptycqdh.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

2. Run the app:
   ```bash
   npm run dev
   ```

3. Visit: `http://localhost:3000`
   - You'll be redirected to `/auth/login`
   - Create a new account or sign in

### 3. Update Environment Variables for Production

When deploying to Vercel/Netlify, add:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your anon key

### 4. User Features Implemented

✅ **Sign Up** - New account creation with password validation
✅ **Sign In** - Email/password login
✅ **Protected Routes** - Dashboard only accessible when logged in
✅ **Session Management** - Automatic session handling
✅ **Logout** - Visible in top bar with user email
✅ **Auth Callback** - Email verification redirect

### 5. Database Security

Your data is now protected by:
- Row-level security (RLS) policies on all tables
- Users can only access their own data
- All queries use authenticated session

### 6. Next Steps (Optional)

Consider adding:
- Password reset functionality
- Social login (Google, GitHub)
- Two-factor authentication
- User profile management

## Testing

1. Create a test account
2. Log in and verify data is secure
3. Open another incognito window and verify you can't access data without login
4. Try the logout button

## Troubleshooting

**Error: "Cannot find name 'useAuth'"**
- Make sure you're wrapping the component with `<ProtectedRoute>`

**Login redirect loop**
- Check that AuthProvider is in `app/layout.tsx`
- Clear browser cache

**Email not sending**
- Check Supabase SMTP settings
- Verify sender email is configured
