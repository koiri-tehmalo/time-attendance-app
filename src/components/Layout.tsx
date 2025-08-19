"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function Layout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ email: string } | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUser({ email: user.email || "" })
    }
    fetchUser()
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <div className="flex gap-4">
          <Link href="/" className="hover:underline">HOME</Link>
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
          <Link href="/enroll" className="hover:underline">Enroll</Link>
        </div>
        <div>
          {user ? <span>Logged in as: {user.email}</span> : <span>Not logged in</span>}
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
