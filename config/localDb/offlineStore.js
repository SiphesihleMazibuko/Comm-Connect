import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { uploadReportImages } from '../mediaUpload';

const RECORDS_KEY = 'pinpoint:offline:records';
const QUEUE_KEY = 'pinpoint:offline:queue';
const QUEUED_TABLES = new Set([
  'pinpoints',
  'posts',
  'reports',
  'emergency_dispatches',
  'emergencyRequests',
  'users',
]);

let online = true;
let syncInProgress = false;
const listeners = new Set();

const log = (...args) => console.log('[OfflineSync]', ...args);
const warn = (...args) => console.warn('[OfflineSync]', ...args);
const errorLog = (...args) => console.error('[OfflineSync]', ...args);

const makeId = () => {
  if (global.crypto?.randomUUID) return global.crypto.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const digit = char === 'x' ? value : (value & 0x3) | 0x8;
    return digit.toString(16);
  });
};

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readRecords = async () => {
  const value = await AsyncStorage.getItem(RECORDS_KEY);
  return parseJson(value, {});
};

const writeRecords = async (records) => {
  await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records));
};

const readQueue = async () => {
  const value = await AsyncStorage.getItem(QUEUE_KEY);
  return parseJson(value, []);
};

const writeQueue = async (queue) => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

const getTableRecords = (records, table) => records[table] || {};

const normalizeFilters = (options = {}) => {
  const filters = { ...(options.filters || {}) };

  if (options.eq) {
    options.eq.forEach(({ column, value }) => {
      filters[column] = value;
    });
  }

  return filters;
};

const matchesFilters = (row, filters) => (
  Object.keys(filters).every((key) => row?.[key] === filters[key])
);

const applyOrdering = (rows, order = []) => {
  if (!order.length) return rows;

  return [...rows].sort((left, right) => {
    for (const rule of order) {
      const leftValue = left?.[rule.column];
      const rightValue = right?.[rule.column];

      if (leftValue === rightValue) continue;

      const direction = rule.ascending ? 1 : -1;
      return leftValue > rightValue ? direction : -direction;
    }

    return 0;
  });
};

export const isOnline = () => online;

export const onConnectivityChange = (listener) => {
  listeners.add(listener);
  listener(online);
  return () => listeners.delete(listener);
};

export const startConnectivityMonitor = (syncCallback) => (
  NetInfo.addEventListener((state) => {
    const nextOnline = state.isConnected !== false && state.isInternetReachable !== false;

    if (online === nextOnline) return;
    online = nextOnline;
    log(`Connection changed: ${online ? 'ONLINE' : 'OFFLINE'}`, {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    });
    listeners.forEach((listener) => listener(online));

    if (online && syncCallback) {
      log('Connection restored. Starting queued sync.');
      syncCallback().catch((error) => errorLog('Offline sync failed:', error));
    }
  })
);

export const refreshConnectivity = async () => {
  try {
    const state = await NetInfo.fetch();
    online = state.isConnected !== false && state.isInternetReachable !== false;
    log(`Connectivity check: ${online ? 'ONLINE' : 'OFFLINE'}`, {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    });
  } catch {
    online = false;
    warn('Connectivity check failed. Treating app as OFFLINE.');
  }

  return online;
};

export const getLocalRows = async (table, options = {}) => {
  const records = await readRecords();
  const filters = normalizeFilters(options);
  const rows = Object.values(getTableRecords(records, table))
    .filter((entry) => !entry.deletedAt)
    .map((entry) => entry.data)
    .filter((row) => matchesFilters(row, filters));

  const orderedRows = applyOrdering(rows, options.order || []);
  log(`Read ${orderedRows.length} local row(s) from ${table}`, { filters });
  return orderedRows;
};

export const getLocalRow = async (table, id) => {
  const records = await readRecords();
  const entry = getTableRecords(records, table)[id];
  const row = entry && !entry.deletedAt ? entry.data : null;
  log(`${row ? 'Found' : 'Missed'} local row ${table}/${id}`);
  return row;
};

export const cacheRows = async (table, rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const records = await readRecords();
  const tableRecords = { ...getTableRecords(records, table) };

  rows.forEach((row) => {
    if (!row?.id) return;
    tableRecords[row.id] = {
      data: row,
      pendingOp: tableRecords[row.id]?.pendingOp || null,
      updatedAt: Date.now(),
      deletedAt: null,
    };
  });

  await writeRecords({ ...records, [table]: tableRecords });
  log(`Cached ${rows.length} remote row(s) into ${table}`);
};

export const cacheRow = async (table, row) => {
  if (!row?.id) return row || null;

  const records = await readRecords();
  const tableRecords = { ...getTableRecords(records, table) };

  tableRecords[row.id] = {
    data: row,
    pendingOp: tableRecords[row.id]?.pendingOp || null,
    updatedAt: Date.now(),
    deletedAt: null,
  };

  await writeRecords({ ...records, [table]: tableRecords });
  log(`Cached remote row ${table}/${row.id}`);
  return row;
};

const enqueue = async (table, id, operation, data) => {
  if (!QUEUED_TABLES.has(table)) return;

  const queue = await readQueue();
  queue.push({
    id: makeId(),
    table,
    recordId: id,
    operation,
    data: data || {},
    createdAt: Date.now(),
    lastError: null,
  });
  await writeQueue(queue);
  log(`Queued ${operation} for ${table}/${id}. Queue length: ${queue.length}`);
};

export const saveLocalMutation = async (table, operation, data = {}, id = data.id) => {
  const recordId = id || makeId();
  const records = await readRecords();
  const tableRecords = { ...getTableRecords(records, table) };
  const existing = tableRecords[recordId]?.data || {};
  const payload = operation === 'update'
    ? { ...existing, ...data, id: recordId }
    : { ...data, id: recordId };

  if (operation === 'delete') {
    if (tableRecords[recordId]) {
      tableRecords[recordId] = {
        ...tableRecords[recordId],
        pendingOp: 'delete',
        updatedAt: Date.now(),
        deletedAt: Date.now(),
      };
    }
  } else {
    tableRecords[recordId] = {
      data: payload,
      pendingOp: operation,
      updatedAt: Date.now(),
      deletedAt: null,
    };
  }

  await writeRecords({ ...records, [table]: tableRecords });
  await enqueue(table, recordId, operation, operation === 'update' ? { ...data, id: recordId } : payload);
  log(`Saved local ${operation} for ${table}/${recordId}`, {
    willSync: QUEUED_TABLES.has(table),
  });

  return operation === 'delete' ? true : payload;
};

const removeQueueItem = async (queueItemId) => {
  const queue = await readQueue();
  const nextQueue = queue.filter((item) => item.id !== queueItemId);
  await writeQueue(nextQueue);
  log(`Removed synced queue item ${queueItemId}. Queue length: ${nextQueue.length}`);
};

const markQueueError = async (queueItemId, error) => {
  const queue = await readQueue();
  await writeQueue(queue.map((item) => (
    item.id === queueItemId
      ? { ...item, lastError: error.message || 'Sync failed' }
      : item
  )));
  errorLog(`Queue item ${queueItemId} failed to sync:`, error);
};

const removeLocalRecord = async (table, id) => {
  const records = await readRecords();
  const tableRecords = { ...getTableRecords(records, table) };
  delete tableRecords[id];
  await writeRecords({ ...records, [table]: tableRecords });
  log(`Removed local record ${table}/${id}`);
};

const normalizeReportPayload = (data = {}) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;

  const { crimCategory, ...payload } = data;
  if (crimCategory && !payload.crimeCategory) {
    payload.crimeCategory = crimCategory;
  }

  return payload;
};

const getMissingSchemaColumn = (error) => {
  if (error?.code !== 'PGRST204') return null;
  const match = error?.message?.match(/Could not find the '([^']+)' column/);
  return match?.[1] || null;
};

export const syncQueuedChanges = async (supabase) => {
  if (syncInProgress) {
    log('Sync skipped because another sync is already running.');
    return;
  }

  if (!(await refreshConnectivity())) {
    log('Sync skipped because app is offline.');
    return;
  }

  syncInProgress = true;

  try {
    const queue = await readQueue();
    log(`Sync starting. Queue length: ${queue.length}`);

    for (const item of queue) {
      const { table, recordId, operation } = item;
      let payload = table === 'reports' ? normalizeReportPayload(item.data || {}) : item.data || {};

      try {
        log(`Syncing ${operation} for ${table}/${recordId}`);
        if (operation === 'delete') {
          const { error } = await supabase.from(table).delete().eq('id', recordId);
          if (error) throw error;
          await removeLocalRecord(table, recordId);
          await removeQueueItem(item.id);
          log(`Synced delete for ${table}/${recordId}`);
          continue;
        }

        if (table === 'reports' && Array.isArray(payload.photoUrls) && payload.photoUrls.length > 0) {
          log(`Uploading ${payload.photoUrls.length} report image(s) before syncing ${recordId}`);
          payload = {
            ...payload,
            photoUrls: await uploadReportImages(payload.photoUrls),
          };
        }

        const { id: _id, ...updatePayload } = payload;
        const query = operation === 'update'
          ? supabase.from(table).update(updatePayload).eq('id', recordId)
          : supabase.from(table).upsert(payload);

        let { data, error } = await query.select().single();
        const missingColumn = getMissingSchemaColumn(error);

        if (missingColumn && missingColumn in payload) {
          const { [missingColumn]: _missingColumn, ...fallbackPayload } = payload;
          payload = fallbackPayload;
          const { id: _fallbackId, ...fallbackUpdatePayload } = payload;
          const fallbackQuery = operation === 'update'
            ? supabase.from(table).update(fallbackUpdatePayload).eq('id', recordId)
            : supabase.from(table).upsert(payload);
          const fallbackResult = await fallbackQuery.select().single();
          data = fallbackResult.data;
          error = fallbackResult.error;
        }

        if (error) throw error;

        await cacheRow(table, data || payload);
        await removeQueueItem(item.id);
        log(`Synced ${operation} for ${table}/${recordId}`);
      } catch (error) {
        await markQueueError(item.id, error);
        throw error;
      }
    }
    log('Sync complete.');
  } finally {
    syncInProgress = false;
  }
};
