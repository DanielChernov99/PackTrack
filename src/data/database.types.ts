/** Version-controlled public schema types. Regenerate after changing SQL migrations. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type ProfileRow = { id: string; created_at: string; updated_at: string };
export type CompensationRow = {
  id: string;
  user_id: string;
  effective_from: string;
  rates: Json;
  created_at: string;
  updated_at: string;
};
export type ShiftRow = {
  id: string;
  user_id: string;
  work_date: string;
  start_at: string;
  end_at: string;
  break_minutes: number;
  counts: Json;
  rates_snapshot: Json;
  notes: string;
  time_disambiguation: string;
  version: number;
  created_at: string;
  updated_at: string;
  last_request: Json;
};
export type BonusRow = {
  id: string;
  user_id: string;
  shift_id: string;
  amount: number;
  description: string;
  position: number;
  created_at: string;
};
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      compensation_history: Table<CompensationRow>;
      shifts: Table<ShiftRow>;
      shift_bonuses: Table<BonusRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      save_shift: {
        Args: { p_shift: Json; p_expected_version: number; p_override?: Json };
        Returns: Json;
      };
      delete_shift: {
        Args: { p_id: string; p_expected_version: number };
        Returns: undefined;
      };
      set_compensation: {
        Args: { p_effective_from: string; p_rates: Json };
        Returns: CompensationRow;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
