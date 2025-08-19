"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"

export function useUserSession() {
  const [user, setUser] = useState<any>(null)
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUser(null)
        setUserName(null)
        return
      }
      setUser(user)

      const { data: profile } = await supabase
        .from("users_profile")
        .select("full_name")
        .eq("user_id", user.id)
        .single()
      setUserName(profile?.full_name || user.email || "")
    }

    fetchUser()

    // ฟังการเปลี่ยนแปลง session (Login/Logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        fetchUser()
      } else {
        setUser(null)
        setUserName(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserName(null)
  }

  return { user, userName, logout }
}
