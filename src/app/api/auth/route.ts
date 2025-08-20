// src/app/api/auth/route.ts
import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export async function POST(req: NextRequest) {
  try {
    const body: { email: string; password: string } = await req.json()  // ระบุ type แทน any
    const { email, password } = body

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) return NextResponse.json({ error: error.message }, { status: 401 })

    return NextResponse.json({ user: data.user })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
