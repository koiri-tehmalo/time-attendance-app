"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import * as faceapi from "face-api.js"
import { haversineDistanceM } from "@/lib/distance"
import Layout from "@/components/Layout"


interface Punch {
  id: string
  punch_type: string
  created_at: string
}

export default function DashboardPage() {
  const [punches, setPunches] = useState<Punch[]>([])
  const [status, setStatus] = useState("")

  useEffect(() => {
    fetchPunches()
    const loadModels = async () => {
      setStatus("Loading face models...")
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models")
      ])
      setStatus("Models loaded")
    }
    loadModels()
  }, [])

  const fetchPunches = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("time_punches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    setPunches(data as Punch[])
  }

  const handlePunch = async (punch_type: string) => {
    setStatus("Getting location...")
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    )
    const { latitude, longitude } = pos.coords

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from("users_profile")
      .select("face_embedding")
      .eq("user_id", user.id)
      .single()

    if (!profile?.face_embedding) {
      setStatus("No face enrolled")
      return
    }

    setStatus("Capturing face...")
    const video = document.createElement("video")
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    video.srcObject = stream
    await video.play()

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
      .withFaceLandmarks()
      .withFaceDescriptor()

    stream.getTracks().forEach(t => t.stop())

    if (!detection) {
      setStatus("No face detected")
      return
    }

    const embedding = detection.descriptor
    const distanceScore = faceapi.euclideanDistance(
      embedding,
      new Float32Array(profile.face_embedding)
    )

    if (distanceScore > 0.6) {
      setStatus("Face does not match")
      return
    }

    const { data: locs } = await supabase.from("locations").select("*")
    if (!locs) return

    const location = locs.find((l: any) => haversineDistanceM(latitude, longitude, l.latitude, l.longitude) <= l.radius_m)
    if (!location) {
      setStatus("Not in allowed location")
      return
    }

    const { error } = await supabase.from("time_punches").insert({
      user_id: user.id,
      location_id: location.id,
      punch_type,
      lat: latitude,
      lng: longitude,
      distance_m: haversineDistanceM(latitude, longitude, location.latitude, location.longitude),
      face_score: distanceScore
    })

    if (error) setStatus("Punch failed: " + error.message)
    else setStatus("Punch success!")

    fetchPunches()
  }

  return (
  <Layout>
    <div className="p-6 min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="mb-4 text-gray-600">{status}</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => handlePunch("IN_AM")} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">เข้าเช้า</button>
        <button onClick={() => handlePunch("OUT_LUNCH")} className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">ออกเที่ยง</button>
        <button onClick={() => handlePunch("IN_PM")} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">เข้าบ่าย</button>
        <button onClick={() => handlePunch("OUT_PM")} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">ออกเย็น</button>
      </div>

      <h2 className="text-2xl font-semibold mb-2">ประวัติลงเวลา</h2>
      <table className="w-full border border-gray-300 rounded">
        <thead className="bg-gray-200">
          <tr>
            <th className="p-2 border">เวลา</th>
            <th className="p-2 border">ประเภท</th>
          </tr>
        </thead>
        <tbody>
          {punches.map(p => (
            <tr key={p.id}>
              <td className="p-2 border">{new Date(p.created_at).toLocaleString()}</td>
              <td className="p-2 border">{p.punch_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Layout>
)
}
