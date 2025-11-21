'use server';

import supabase from '@/lib/supabaseClient';

// Create a new user (Admin only)
export async function createUser(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (error) {
      return { error: error.message, data: null };
    }

    return { error: null, data };
  } catch (err: any) {
    return { error: err.message, data: null };
  }
}

// Get all users (Admin only)
export async function getAllUsers() {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      return { error: error.message, data: null };
    }

    return { error: null, data: data.users || [] };
  } catch (err: any) {
    return { error: err.message, data: null };
  }
}

// Delete a user (Admin only)
export async function deleteUser(userId: string) {
  try {
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}
