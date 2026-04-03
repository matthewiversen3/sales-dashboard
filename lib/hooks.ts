"use client";

import { useCallback, useEffect, useState } from "react";
import { getData, StoreData } from "./store";
import { seedDemoData } from "./seed";

export function useStore() {
  const [data, setData] = useState<StoreData>({
    salespeople: [],
    deals: [],
    payments: [],
    reminders: [],
    calls: [],
    settings: { tldvApiKey: "", tldvLastSync: null, ghlApiKey: "", ghlLocationId: "", ghlLastSync: null },
  });
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    setData(getData());
  }, []);

  useEffect(() => {
    seedDemoData();
    refresh();
    setLoaded(true);
  }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refresh]);

  return { ...data, refresh, loaded };
}
