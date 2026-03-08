import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://odhsdzhpkfransjjmeps.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kaHNkemhwa2ZyYW5zamptZXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDc3OTksImV4cCI6MjA4ODU4Mzc5OX0.iAuGif67WMHz1dzKocj7t0XraU6h3phMtctNa724XZU"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
