"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

export default function Layout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState<string | null>(null)
  const [status, setStatus] = useState("")

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUserName(null)
        return
      }
      // ดึงชื่อจาก users_profile
      const { data: profile } = await supabase
        .from("users_profile")
        .select("full_name")
        .eq("user_id", user.id)
        .single()
      setUserName(profile?.full_name || user.email || "")
    }

    fetchUser()

    // ฟัง event ของ session change
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        fetchUser()
      } else {
        setUserName(null)
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <div className="flex gap-4">
          <Link href="/" className="hover:underline">Home</Link>
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
          <Link href="/enroll" className="hover:underline">Enroll</Link>
        </div>
        
        <div className="flex items-center gap-2">
          {userName ? (
            <>
              <span>{userName}</span>
              <button
                onClick={async () => {
                await supabase.auth.signOut()
                setUserName(null)
                setStatus("Logged out")
        }}
        className="px-3 py-1 bg-red-500 rounded hover:bg-red-600 text-white text-sm"
        >
        Logout
        </button>
            </>
          ) : (
            <span>Not logged in</span>
          )}
          <Link
          href="/login"
          className="px-3 py-1 bg-blue-500 rounded hover:bg-blue-600 text-white text-sm"
            >
            Login
            </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      {status && <p className="p-2 text-center text-gray-700">{status}</p>}
    </div>
  )
}
