/* ============================================================
   CUADRE — cliente de Supabase (auth + datos en la nube)
   La publishable key es pública por diseño; la seguridad la dan
   las políticas RLS de la tabla app_state.
   ============================================================ */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gsgfjtyiqyssfuroggqw.supabase.co";
const SUPABASE_KEY = "sb_publishable_Z89zZ4wM-6DJJQsI3mZM9A_lkpDVPSJ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
