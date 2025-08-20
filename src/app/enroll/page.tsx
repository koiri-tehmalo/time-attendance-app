"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import Layout from "@/components/Layout"

export default function EnrollPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState("Initializing...")
  const [faceapi, setFaceapi] = useState<typeof import("face-api.js") | null>(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)

  // โหลดโมเดลตอน mount
  useEffect(() => {
    const loadModels = async () => {
      setStatus("Loading face models...")
      try {
        const faceapiModule = await import("face-api.js")
        setFaceapi(faceapiModule)

        // โหลดโมเดลทั้งหมด
        await Promise.all([
          faceapiModule.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapiModule.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapiModule.nets.faceRecognitionNet.loadFromUri("/models"),
        ])

        setModelsLoaded(true)
        setStatus("Models loaded. Ready!")
      } catch (err) {
        console.error(err)
        setStatus("Failed to load face models")
      }
    }

    loadModels()
  }, [])

  // เริ่มกล้อง
  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) videoRef.current.srcObject = stream
      setStatus("Camera started")
    } catch (err) {
      console.error(err)
      setStatus("Failed to access camera")
    }
  }

  // Enroll หน้า
  const handleEnroll = async () => {
    if (!videoRef.current) {
      setStatus("Camera not started")
      return
    }
    if (!faceapi || !modelsLoaded) {
      setStatus("Models not loaded yet")
      return
    }

    setStatus("Capturing face...")

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor()

      if (!detection) {
        setStatus("No face detected")
        return
      }

      // embedding 128 ค่า
      const embedding: number[] = Array.from(detection.descriptor)
      console.log("Embedding length:", embedding.length)

      // ดึง user จาก Supabase
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

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
    } catch (err) {
      console.error(err)
      setStatus("Error capturing face")
    }
  }

  return (
    <Layout>
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-4">
        <h1 className="text-3xl font-bold">Enroll Face</h1>
        <p className="text-center mb-2 text-gray-700">บันทึก/อัปเดตใบหน้าใหม่</p>
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
