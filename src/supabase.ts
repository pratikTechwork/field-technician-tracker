import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const TABLE_NAME = "technician_tracker_complaint";
export const PUNCHIN_TABLE = "field_technician_punchin";
export const PUNCHOUT_TABLE = "field_technician_punchout";

