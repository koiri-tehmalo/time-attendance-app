"use client"

import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-4xl font-bold mb-6 text-center">
        Time Attendance System
      </h1>

      <p className="text-center mb-8 text-gray-700">
        ระบบลงเวลาเข้า-ออกด้วยใบหน้าและ GPS
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/login" className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
          Login
        </Link>

        <Link href="/enroll" className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 transition">
          Enroll Face
        </Link>

        <Link href="/dashboard" className="px-6 py-3 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition">
          Dashboard
        </Link>
      </div>

      <footer className="mt-12 text-gray-500 text-sm">
        &copy; 2025 Your Company. All rights reserved.
      </footer>
    </main>
  )
}
