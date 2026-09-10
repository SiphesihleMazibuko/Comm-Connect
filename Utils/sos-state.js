const STOPPED_STATUSES = new Set(['cancelled', 'completed', 'resolved']);

export const resolveSosUpdate = (rows, currentId) => {
  const active = rows.find((row) => row.status === 'active');
  if (active) return { kind: 'active', alert: active };
  if (currentId && rows.some((row) => row.id === currentId && STOPPED_STATUSES.has(row.status))) {
    return { kind: 'stopped' };
  }
  // Missing records or an intermediate status do not confirm a stop.
  return { kind: 'unchanged' };
};
