"use client";
import { useEffect, useState } from "react";
import { parseValidationRecords, VALIDATION_EVENT, VALIDATION_STORAGE_KEY, type ValidationRecord } from "./lab-validation";
export function useValidationLibrary() {
  const [records, setRecords] = useState<ValidationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    function read() {
      try { setRecords(parseValidationRecords(localStorage.getItem(VALIDATION_STORAGE_KEY))); setError(""); }
      catch { setError("Validation storage is unavailable or damaged. No records were overwritten. Export or restore your browser data before continuing."); }
      finally { setLoading(false); }
    }
    function changed(event: StorageEvent) { if (event.key === VALIDATION_STORAGE_KEY || event.key === null) read(); }
    read(); window.addEventListener(VALIDATION_EVENT, read); window.addEventListener("storage", changed);
    return () => { window.removeEventListener(VALIDATION_EVENT, read); window.removeEventListener("storage", changed); };
  }, []);
  return { records, loading, error };
}
