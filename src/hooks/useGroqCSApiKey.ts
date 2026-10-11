import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { dbRealtime } from "../lib/firebase";

export function useGroqCSApiKey() {
  const [apiKey, setApiKey] = useState<string>("");

  useEffect(() => {
    const apiRef = ref(dbRealtime, "global_settings/apiKeys/groq_cs");
    const unsubscribe = onValue(apiRef, (snapshot) => {
      if (snapshot.exists()) {
        setApiKey(snapshot.val());
      } else {
        setApiKey("");
      }
    });

    return () => unsubscribe();
  }, []);

  return apiKey;
}
