import type { Compensation, Rates, Role, Shift, ShiftDraft } from "../domain";

export interface AuthSession {
  user: { id: string; email: string };
}
export type AuthEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "PASSWORD_RECOVERY"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "MFA_CHALLENGE_VERIFIED";
export interface AuthAdapter {
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(
    callback: (event: AuthEvent, session: AuthSession | null) => void,
  ): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(
    email: string,
    password: string,
    role: Role,
    hourlyRate?: number | null,
  ): Promise<{ needsEmailVerification: boolean }>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updatePassword(password: string, nonce?: string): Promise<void>;
  reauthenticate(): Promise<void>;
  updateEmail(email: string): Promise<void>;
  resendVerification(email: string): Promise<void>;
}
export interface Profile {
  id: string;
  createdAt: string;
}
export interface PackTrackRepository {
  getProfile(): Promise<Profile>;
  getShifts(fromDate?: string, toDate?: string): Promise<Shift[]>;
  getShift(id: string): Promise<Shift | null>;
  getCompensationSettings(): Promise<Compensation[]>;
  updateCompensationSettings(
    config: Omit<Compensation, "id">,
  ): Promise<Compensation>;
  saveShift(
    draft: ShiftDraft,
    expectedVersion?: number,
    override?: Rates,
  ): Promise<Shift>;
  deleteShift(id: string, version: number): Promise<void>;
}
export interface AppServices {
  repository: PackTrackRepository;
  auth: AuthAdapter;
}
export interface PublicEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
