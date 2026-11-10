import { useCallback, useEffect, useState } from "react";
import { useApp } from "./context";
import type { Shift } from "../domain";
import { messageOf } from "../components/Common";
export function useShifts(from?: string, to?: string) {
  const { repository } = useApp();
  const [data, setData] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((x) => x + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    repository
      .getShifts(from, to)
      .then((rows) => {
        if (active) setData(rows);
      })
      .catch((e) => {
        if (active) setError(messageOf(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repository, from, to, revision]);
  return { data, loading, error, reload };
}
