function requirePublicEnvironmentVariable(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Add it to mobile/.env before starting the app.`);
  }
  return value;
}

export const environment = {
  supabaseUrl: requirePublicEnvironmentVariable(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: requirePublicEnvironmentVariable(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
  // Safety default: development builds never silently target public tables.
  supabaseSchema: process.env.EXPO_PUBLIC_SUPABASE_SCHEMA || 'working',
} as const;
