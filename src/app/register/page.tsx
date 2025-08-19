"use client"

import { useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"
import * as faceapi from "face-api.js"
import Link from "next/link"


export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const [faceCaptured, setFaceCaptured] = useState(false)
  const [faceEmbedding, setFaceEmbedding] = useState<Float32Array | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!faceCaptured || !faceEmbedding) {
      setStatus("Please capture your face first")
      return
    }

    setStatus("Creating account...")
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setStatus("Error: " + error.message)
      return
    }

    // เพิ่ม profile พร้อม face embedding
    const { error: profileError } = await supabase.from("users_profile").insert({
      user_id: data.user?.id,
      full_name: name,
      face_embedding: Array.from(faceEmbedding),
    })

    if (profileError) {
      setStatus("Profile creation failed: " + profileError.message)
      return
    }

    setStatus("Registration successful!")
    router.push("/login")
  }

  const captureFace = async () => {
    setStatus("Loading face models...")
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ])
    setStatus("Models loaded. Starting camera...")

    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    if (videoRef.current) videoRef.current.srcObject = stream
    await videoRef.current?.play()

    setStatus("Detecting face...")
    const detection = await faceapi
      .detectSingleFace(videoRef.current!, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor()

    stream.getTracks().forEach(t => t.stop())

    if (!detection) {
      setStatus("No face detected")
      return
    }

    setFaceEmbedding(detection.descriptor)
    setFaceCaptured(true)
    setStatus("Face captured successfully!")
  }

  return (
    <>
    <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <div className="flex gap-4">
          <Link href="/" className="hover:underline">HOME</Link>
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
          <Link href="/enroll" className="hover:underline">Enroll</Link>
        </div>
      </header>
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-4">
      <h1 className="text-3xl font-bold mb-6">Register / Enroll</h1>
      <form onSubmit={handleRegister} className="flex flex-col gap-4 w-80">
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="px-4 py-2 border rounded"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="px-4 py-2 border rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="px-4 py-2 border rounded"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          Register
        </button>
      </form>

      <p className="mt-2 text-dark">or capture your face below</p>
      <button
        onClick={captureFace}
        className="px-4 py-2 bg-green-500 text-dark rounded hover:bg-green-600 transition"
      >
        Capture Face
      </button>

      <video ref={videoRef} autoPlay muted className="hidden" />

      <p className="mt-4 text-gray-600">{status}</p>
    </main>
    </>
  )
}
