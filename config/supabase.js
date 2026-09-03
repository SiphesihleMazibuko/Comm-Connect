import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";
import {
  cacheRow,
  cacheRows,
  getLocalRow,
  getLocalRows,
  isOnline,
  refreshConnectivity,
  saveLocalMutation,
  startConnectivityMonitor,
  syncQueuedChanges,
} from "./localDb/offlineStore";

const isBrowser = Platform.OS === "web" && typeof window !== "undefined" && window.document !== undefined;
const isServerRender = Platform.OS === "web" && !isBrowser;
const offlineLog = (...args) => console.log("[SupabaseOffline]", ...args);
const offlineWarn = (...args) => console.warn("[SupabaseOffline]", ...args);

// Create storage adapter that works on both web and native
const createStorage = () => {
  if (isServerRender) {
    console.log("Using memory storage for server render");
    return {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    };
  }

  if (Platform.OS === "web") {
    console.log("Using localStorage for web");
    return {
      getItem: (key) => {
        try {
          return Promise.resolve(localStorage.getItem(key));
        } catch (e) {
          console.log(e,"localStorage getItem error");
          return Promise.resolve(null);
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
          return Promise.resolve();
        } catch (e) {
          console.log(e,"localStorage setItem error");
          return Promise.resolve();
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
          return Promise.resolve();
        } catch (e) {
        console.log(e,"localStorage removeItem error");
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
  console.log(e, "AsyncStorage not available, using memory storage");
    
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
  console.warn("Missing Supabase environment variables");
}

console.log("Initializing Supabase client...");

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

startConnectivityMonitor(() => syncQueuedChanges(supabase));
refreshConnectivity().then((online) => {
  offlineLog(`Initial connectivity: ${online ? "ONLINE" : "OFFLINE"}`);
  if (online) syncQueuedChanges(supabase).catch((error) => console.error("Initial offline sync failed:", error));
});

const applyEqFilters = (query, options = {}) => {
  if (options.filters) {
    Object.keys(options.filters).forEach((key) => {
      query = query.eq(key, options.filters[key]);
    });
  }

  if (options.eq) {
    options.eq.forEach(({ column, value }) => {
      query = query.eq(column, value);
    });
  }

  if (options.neq) {
    options.neq.forEach(({ column, value }) => {
      query = query.neq(column, value);
    });
  }

  return query;
};

const isLikelyNetworkError = (error) => {
  const message = `${error?.message || ""} ${error?.name || ""}`.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("failed to fetch") ||
    message.includes("load failed")
  );
};

export const isMissingSchemaRelation = (error) => (
  error?.code === "PGRST205"
  || `${error?.message || ""}`.includes("Could not find the table")
);

// GET CURRENT USER
export const getCurrentUser = async () => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn("Error getting current session:", error);
      return null;
    }

    return session?.user || null;
  } catch (error) {
    console.warn("Error getting current user session:", error);
    return null;
  }
};

//GET ROWS FROM ANY TABLE
export const getRows = async (table, options = {}) => {
  try {
    if (!(await refreshConnectivity())) {
      return await getLocalRows(table, options);
    }

    let query = supabase.from(table).select("*");
    query = applyEqFilters(query, options);

    if (options.order) {
      options.order.forEach((order) => {
        query = query.order(order.column, {
          ascending: order.ascending || false,
        });
      });
    }

    const { data, error } = await query;
    if (error) throw error;
    await cacheRows(table, data || []);
    offlineLog(`getRows(${table}): fetched ${data?.length || 0} remote row(s), cached locally.`);
    return data || [];
  } catch (error) {
    if (options.allowMissingTable && isMissingSchemaRelation(error)) {
      options.onMissingTable?.(error);
      offlineWarn(`getRows(${table}): table is not available in the Supabase schema cache yet.`);
      return [];
    }

    console.error(`Error getting rows from ${table}:`, error);
    offlineWarn(`getRows(${table}): falling back to local cache.`);
    return await getLocalRows(table, options);
  }
};

// GET SINGLE ROW
export const getRow = async (table, id) => {
  try {
    if (!(await refreshConnectivity())) {
      offlineLog(`getRow(${table}/${id}): offline, reading local cache.`);
      return await getLocalRow(table, id);
    }

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    await cacheRow(table, data);
    offlineLog(`getRow(${table}/${id}): fetched remote row, cached locally.`);
    return data;
  } catch (error) {
    console.error(`Error getting row from ${table}:`, error);
    offlineWarn(`getRow(${table}/${id}): falling back to local cache.`);
    return await getLocalRow(table, id);
  }
};

// INSERT A ROW
const normalizeReportPayload = (data = {}) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;

  const { crimCategory, ...payload } = data;
  if (crimCategory && !payload.crimeCategory) {
    payload.crimeCategory = crimCategory;
  }

  return payload;
};

const getMissingSchemaColumn = (error) => {
  if (error?.code !== "PGRST204") return null;
  const match = error?.message?.match(/Could not find the '([^']+)' column/);
  return match?.[1] || null;
};

const retryWithoutMissingColumn = async ({ table, data, error, runQuery }) => {
  const missingColumn = getMissingSchemaColumn(error);
  if (!missingColumn || !data || !(missingColumn in data)) throw error;

  const { [missingColumn]: _missingColumn, ...fallbackData } = data;
  offlineWarn(`${table}: retrying without missing schema column "${missingColumn}".`);
  return await runQuery(fallbackData);
};

const runWithMissingColumnRetries = async ({ table, data, runQuery }) => {
  let payload = data;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await runQuery(payload);
    } catch (error) {
      const missingColumn = getMissingSchemaColumn(error);
      if (!missingColumn || !payload || !(missingColumn in payload)) throw error;

      const { [missingColumn]: _missingColumn, ...fallbackPayload } = payload;
      payload = fallbackPayload;
      offlineWarn(`${table}: retrying without missing schema column "${missingColumn}".`);
    }
  }

  return await runQuery(payload);
};

export const insertRow = async (table, data) => {
  try {
    const payload = table === "reports" ? normalizeReportPayload(data) : data;

    if (!(await refreshConnectivity())) {
      offlineLog(`insertRow(${table}): offline, saving locally and queueing insert.`);
      return await saveLocalMutation(table, "insert", payload);
    }

    const runInsert = async (insertPayload) => {
      const { data: insertedRow, error } = await supabase
        .from(table)
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;
      return insertedRow;
    };
    
    let inserted;
    try {
      inserted = await runInsert(payload);
    } catch (error) {
      inserted = await retryWithoutMissingColumn({
        table,
        data: payload,
        error,
        runQuery: runInsert,
      });
    }

    await cacheRow(table, inserted);
    offlineLog(`insertRow(${table}): inserted remotely and cached ${inserted?.id || "new row"}.`);
    return inserted;
  } catch (error) {
    console.error(`Error inserting row into ${table}:`, error);
    if (!isOnline() || isLikelyNetworkError(error)) {
      offlineWarn(`insertRow(${table}): network failure, saving locally and queueing insert.`);
      return await saveLocalMutation(table, "insert", table === "reports" ? normalizeReportPayload(data) : data);
    }
    throw error;
  }
};

// UPDATE A ROW
export const updateRow = async (table, id, data) => {
  try {
    const payload = table === "reports" ? normalizeReportPayload(data) : data;

    if (!(await refreshConnectivity())) {
      offlineLog(`updateRow(${table}/${id}): offline, saving locally and queueing update.`);
      return await saveLocalMutation(table, "update", payload, id);
    }

    const runUpdate = async (updatePayload) => {
      const { data: updatedRow, error } = await supabase
        .from(table)
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updatedRow;
    };

    let updated;
    try {
      updated = await runUpdate(payload);
    } catch (error) {
      updated = await retryWithoutMissingColumn({
        table,
        data: payload,
        error,
        runQuery: runUpdate,
      });
    }

    await cacheRow(table, updated);
    offlineLog(`updateRow(${table}/${id}): updated remotely and cached locally.`);
    return updated;
  } catch (error) {
    console.error(`Error updating row in ${table}:`, error);
    if (!isOnline() || isLikelyNetworkError(error)) {
      offlineWarn(`updateRow(${table}/${id}): network failure, saving locally and queueing update.`);
      return await saveLocalMutation(table, "update", table === "reports" ? normalizeReportPayload(data) : data, id);
    }
    throw error;
  }
};

// DELETE A ROW
export const deleteRow = async (table, id) => {
  try {
    if (!(await refreshConnectivity())) {
      offlineLog(`deleteRow(${table}/${id}): offline, marking local delete and queueing delete.`);
      return await saveLocalMutation(table, "delete", {}, id);
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id);
    
    if (error) throw error;
    offlineLog(`deleteRow(${table}/${id}): deleted remotely.`);
    return true;
  } catch (error) {
    console.error(`Error deleting row from ${table}:`, error);
    if (!isOnline() || isLikelyNetworkError(error)) {
      offlineWarn(`deleteRow(${table}/${id}): network failure, marking local delete and queueing delete.`);
      return await saveLocalMutation(table, "delete", {}, id);
    }
    throw error;
  }
};

// SUBSCRIBE TO TABLE CHANGES
export const subscribeToTable = (table, callback) => {
  if (!isOnline()) {
    offlineLog(`subscribeToTable(${table}): offline, skipping realtime subscription.`);
    return () => {};
  }

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
    if (!(await refreshConnectivity())) {
      offlineLog(`getUserProfile(${userId}): offline, reading local cache.`);
      return await getLocalRow("users", userId);
    }

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
    await cacheRow("users", data);
    offlineLog(`getUserProfile(${userId}): fetched remote profile, cached locally.`);
    return data;
  } catch (error) {
    console.error("Error getting user profile:", error);
    offlineWarn(`getUserProfile(${userId}): falling back to local cache.`);
    return await getLocalRow("users", userId);
  }
};

// UPSERT FUNCTION
export const upsertRow = async (table, data) => {
  try {
    if (!(await refreshConnectivity())) {
      offlineLog(`upsertRow(${table}): offline, saving locally and queueing ${data.id ? "update" : "insert"}.`);
      return await saveLocalMutation(table, data.id ? "update" : "insert", data, data.id);
    }

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
        const runUpdate = async (updatePayload) => {
          const { data: updated, error: updateError } = await client
            .from(table)
            .update(updatePayload)
            .eq("id", data.id)
            .select()
            .single();

          if (updateError) throw updateError;
          return updated;
        };

        const updated = await runWithMissingColumnRetries({
          table,
          data,
          runQuery: runUpdate,
        });

        await cacheRow(table, updated);
        offlineLog(`upsertRow(${table}/${data.id}): updated remotely and cached locally.`);
        return updated;
      }
    }

    const runInsert = async (insertPayload) => {
      const { data: inserted, error: insertError } = await client
        .from(table)
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) throw insertError;
      return inserted;
    };

    const inserted = await runWithMissingColumnRetries({
      table,
      data,
      runQuery: runInsert,
    });

    await cacheRow(table, inserted);
    offlineLog(`upsertRow(${table}): inserted remotely and cached ${inserted?.id || "new row"}.`);
    return inserted;
  } catch (error) {
    console.error("Error in upsertRow:", error);
    if (!isOnline() || isLikelyNetworkError(error)) {
      offlineWarn(`upsertRow(${table}): network failure, saving locally and queueing ${data.id ? "update" : "insert"}.`);
      return await saveLocalMutation(table, data.id ? "update" : "insert", data, data.id);
    }
    throw error;
  }
};

export const syncOfflineChanges = async () => {
  offlineLog("Manual sync requested.");
  await syncQueuedChanges(supabase);
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
