"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import * as faceapi from "face-api.js"
import Layout from "@/components/Layout"

export default function EnrollPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState("")

  // โหลดโมเดลตอน mount
  useEffect(() => {
    const loadModels = async () => {
      setStatus("Loading face models...")
      await Promise.all([
 faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"), // <-- TinyNet
        faceapi.nets.faceRecognitionNet.loadFromUri("/models")
])

      setStatus("Models loaded")
    }
    loadModels()
  }, [])

  const startVideo = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    if (videoRef.current) videoRef.current.srcObject = stream
  }

  const handleEnroll = async () => {
    if (!videoRef.current) return
    setStatus("Capturing face...")

    // ตรวจจับใบหน้า + landmarks + embedding
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks(true) // ใช้ Tiny Landmark
      .withFaceDescriptor() // embedding 128

    if (!detection) {
      setStatus("No face detected")
      return
    }

    // embedding 128 ค่า
    const embedding: number[] = Array.from(detection.descriptor)
    console.log("Embedding length:", embedding.length) // ต้อง 128

    // ดึง user จาก Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setStatus("Not logged in")
      return
    }

    // อัปเดต embedding ลง users_profile
    const { error } = await supabase
      .from("users_profile")
      .update({ face_embedding: embedding })
      .eq("user_id", user.id)

    if (error) setStatus("Enroll failed: " + error.message)
    else setStatus("Face enrolled successfully!")
  }

  return (
    <Layout>
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-4">
        <h1 className="text-3xl font-bold">Enroll Face</h1>
        <video
          ref={videoRef}
          autoPlay
          muted
          width={320}
          height={240}
          className="border"
        />
        <div className="flex gap-2">
          <button
            onClick={startVideo}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Start Camera
          </button>
          <button
            onClick={handleEnroll}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Enroll
          </button>
        </div>
        <p className="text-gray-600">{status}</p>
      </main>
    </Layout>
  )
}
