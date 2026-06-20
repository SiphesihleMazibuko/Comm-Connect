import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.'
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.'
    );
  }

  return supabase;
}

export async function getCurrentUser() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user;
}

export async function getUserProfile(userId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getRows(table, options = {}) {
  const client = getSupabaseClient();
  let request = client.from(table).select('*');

  for (const filter of options.eq || []) {
    request = request.eq(filter.column, filter.value);
  }

  for (const filter of options.neq || []) {
    request = request.neq(filter.column, filter.value);
  }

  for (const order of options.order || []) {
    request = request.order(order.column, { ascending: order.ascending ?? true });
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data || [];
}

export async function insertRow(table, row) {
  const client = getSupabaseClient();
  const { data, error } = await client.from(table).insert(row).select().single();

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertRow(table, row) {
  const client = getSupabaseClient();
  const { data, error } = await client.from(table).upsert(row).select().single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateRow(table, id, updates) {
  const client = getSupabaseClient();
  const { data, error } = await client.from(table).update(updates).eq('id', id).select().single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteRow(table, id) {
  const client = getSupabaseClient();
  const { error } = await client.from(table).delete().eq('id', id);

  if (error) {
    throw error;
  }
}

export function subscribeToTable(table, onChange) {
  const client = getSupabaseClient();
  const channel = client
    .channel(`${table}-changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export function getFriendlySupabaseError(error) {
  const message = error?.message || String(error);

  if (message.toLowerCase().includes('unsupported phone provider')) {
    return (
      'Phone OTP is not fully configured in Supabase yet. In Supabase, enable Phone Auth and configure an SMS provider such as Twilio, MessageBird, Vonage, or TextLocal.'
    );
  }

  if (
    message.toLowerCase().includes('schema cache') ||
    message.toLowerCase().includes("could not find the table 'public.users'")
  ) {
    return (
      'A required Supabase table is missing. Run supabase/schema.sql in the Supabase SQL Editor, then wait a few seconds for the API schema cache to refresh.'
    );
  }

  return message;
}
