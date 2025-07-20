
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ujmwwnnyylsqyqqlrykx.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbXd3bm55eWxzcXlxcWxyeWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NzQ1MzQsImV4cCI6MjA2NjQ1MDUzNH0.h47iGnsijAMiWzBnWWnxavSrY4DjsDWU5bTA2o1sIzY'; // ANON PUBLIC KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

