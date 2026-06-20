import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

// Check if we're on web
const isWeb = typeof window !== "undefined" && window.document !== undefined;

// Create storage adapter that works on both web and native
const createStorage = () => {
  if (isWeb) {
    console.log("Using localStorage for web");
    return {
      getItem: (key) => {
        try {
          return Promise.resolve(localStorage.getItem(key));
        } catch (e) {
          return Promise.resolve(null);
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
          return Promise.resolve();
        } catch (e) {
          return Promise.resolve();
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
          return Promise.resolve();
        } catch (e) {
          return Promise.resolve();
        }
      },
    };
  }

  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    console.log("Using AsyncStorage for native");
    return AsyncStorage;
  } catch (e) {
    console.warn("AsyncStorage not available, using memory storage");
    return {
      getItem: (key) => Promise.resolve(null),
      setItem: (key, value) => Promise.resolve(),
      removeItem: (key) => Promise.resolve(),
    };
  }
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Missing Supabase environment variables");
}

console.log("🔐 Initializing Supabase client...");

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ✅ GET CURRENT USER
export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

// ✅ GET ROWS FROM ANY TABLE
export const getRows = async (table, options = {}) => {
  try {
    let query = supabase.from(table).select("*");

    if (options.filters) {
      Object.keys(options.filters).forEach((key) => {
        query = query.eq(key, options.filters[key]);
      });
    }

    if (options.order) {
      options.order.forEach((order) => {
        query = query.order(order.column, {
          ascending: order.ascending || false,
        });
      });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error(`Error getting rows from ${table}:`, error);
    return [];
  }
};

// ✅ GET SINGLE ROW
export const getRow = async (table, id) => {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error getting row from ${table}:`, error);
    return null;
  }
};

// ✅ INSERT A ROW
export const insertRow = async (table, data) => {
  try {
    const { data: inserted, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return inserted;
  } catch (error) {
    console.error(`Error inserting row into ${table}:`, error);
    throw error;
  }
};

// ✅ UPDATE A ROW
export const updateRow = async (table, id, data) => {
  try {
    const { data: updated, error } = await supabase
      .from(table)
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  } catch (error) {
    console.error(`Error updating row in ${table}:`, error);
    throw error;
  }
};

// ✅ DELETE A ROW
export const deleteRow = async (table, id) => {
  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error deleting row from ${table}:`, error);
    throw error;
  }
};

// ✅ SUBSCRIBE TO TABLE CHANGES
export const subscribeToTable = (table, callback) => {
  const channelName = `table-changes-${table}-${Date.now()}`;
  const channel = supabase.channel(channelName);

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: table,
    },
    (payload) => {
      console.log(`Change on ${table}:`, payload);
      if (callback) {
        callback(payload);
      }
    },
  );

  channel.subscribe((status) => {
    console.log(`Subscription for ${table}:`, status);
  });

  return () => {
    console.log(`Unsubscribing from ${table}...`);
    channel.unsubscribe();
  };
};

// Helper function to get user profile
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }
    return data;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};

// ✅ UPSERT FUNCTION
export const upsertRow = async (table, data) => {
  try {
    const client = getSupabaseClient();

    if (data.id) {
      const { data: existing, error: checkError } = await client
        .from(table)
        .select("id")
        .eq("id", data.id)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        throw checkError;
      }

      if (existing) {
        const { data: updated, error: updateError } = await client
          .from(table)
          .update(data)
          .eq("id", data.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return updated;
      }
    }

    const { data: inserted, error: insertError } = await client
      .from(table)
      .insert(data)
      .select()
      .single();

    if (insertError) throw insertError;
    return inserted;
  } catch (error) {
    console.error("Error in upsertRow:", error);
    throw error;
  }
};

// Helper function to get friendly error messages
export const getFriendlySupabaseError = (error) => {
  if (!error) return "An unknown error occurred";

  const message = error.message || "";

  if (message.includes("Invalid login credentials")) {
    return "Invalid phone number or password. Please try again.";
  }
  if (message.includes("Email not confirmed")) {
    return "Please verify your email before logging in.";
  }
  if (message.includes("User not found")) {
    return "No account found with this phone number. Please sign up.";
  }
  if (message.includes("Network request failed")) {
    return "Network error. Please check your internet connection.";
  }
  if (message.includes("OTP expired")) {
    return "The verification code has expired. Please request a new one.";
  }
  if (message.includes("Invalid OTP")) {
    return "Invalid verification code. Please try again.";
  }

  return message;
};

// Get Supabase client (for backwards compatibility)
export const getSupabaseClient = () => supabase;

// Export default for convenience
export default supabase;