import { createContext, useContext } from "react";
import type { AppServices } from "../data";
import type { Compensation } from "../domain";
export interface AppContextValue extends AppServices {
  user: { id: string; email: string };
  compensations: Compensation[];
  refreshCompensations: () => Promise<void>;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("Missing authenticated application context");
  return value;
}
