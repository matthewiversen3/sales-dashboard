"use client";

import { useCallback, useEffect, useState } from "react";
import { getData, StoreData } from "./store";

const defaultData: StoreData = {
  salespeople: [],
  deals: [],
  payments: [],
  reminders: [],
  calls: [],
  settings: { tldvApiKey: "", tldvLastSync: null, ghlApiKey: "", ghlLocationId: "", ghlLastSync: null, anthropicApiKey: "", blandApiKey: "", blandPathwayId: "", aiCallingEnabled: "false", aiCallingGreeting: "" },
};

export function useStore() {
  const [data, setData] = useState<StoreData>(defaultData);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await getData();
      setData(d);
    } catch (err) {
      console.error("Failed to load data from Supabase:", err);
    }
  }, []);

  useEffect(() => {
    refresh().then(() => setLoaded(true));
  }, [refresh]);

  return { ...data, refresh, loaded };
}
