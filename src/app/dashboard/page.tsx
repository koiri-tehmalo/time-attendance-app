"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import Layout from "@/components/Layout"
import { haversineDistanceM } from "@/lib/distance"

interface Punch {
  id: string
  punch_type: string
  created_at_th: string
  location_name: string
}
interface PunchFromDB {
  id: string
  punch_type: string
  created_at_th: string
  locations?: { name: string }[] | null   // <- เป็น array เพราะ Supabase return เป็น array
}

export default function DashboardPage() {
  const [punches, setPunches] = useState<Punch[]>([])
  const [status, setStatus] = useState("")
  const [userLocationId, setUserLocationId] = useState<string | null>(null)
  const [faceapi, setFaceapi] = useState<typeof import("face-api.js") | null>(null)

  // ดึง punches
  // ดึง punches พร้อมชื่อ location
const fetchPunches = async (user_id: string) => {
  const { data, error } = await supabase
  .from("time_punches_th")
  .select(`
    id,
    punch_type,
    created_at_th,
    locations (
      name
    )
  `)
  .eq("user_id", user_id)
  .order("created_at_th", { ascending: false })

// บอก TypeScript ว่า data เป็น PunchFromDB[]
const punchesWithLocation: Punch[] = data?.map((p: PunchFromDB) => ({
  id: p.id,
  punch_type: p.punch_type,
  created_at_th: p.created_at_th,
  location_name: p.locations?.[0]?.name ?? "Unknown", // เลือก element แรก
})) || []


setPunches(punchesWithLocation)

}


  useEffect(() => {
    const fetchSessionAndPunches = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus("Not logged in")
        return
      }

      // ดึง location_id ของผู้ใช้
      const { data: profile } = await supabase
        .from("users_profile")
        .select("location_id")
        .eq("user_id", user.id)
        .single()
      setUserLocationId(profile?.location_id || null)

      fetchPunches(user.id)
    }

    fetchSessionAndPunches()

    // Dynamic import face-api.js
    const loadModels = async () => {
      setStatus("Loading face models...")
      const faceapiModule = await import("face-api.js")
      setFaceapi(faceapiModule)
      await Promise.all([
        faceapiModule.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapiModule.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapiModule.nets.faceRecognitionNet.loadFromUri("/models"),
      ])
      setStatus("Models loaded")
    }
    loadModels()
  }, [])

  const handlePunch = async (punch_type: string) => {
    if (!faceapi) {
      setStatus("Face API not loaded")
      return
    }

    setStatus("Getting location...")
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    )
    const { latitude, longitude } = pos.coords

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // ดึง face embedding และ location_id ของผู้ใช้
    const { data: profile } = await supabase
      .from("users_profile")
      .select("face_embedding, location_id")
      .eq("user_id", user.id)
      .single()

    if (!profile?.face_embedding) {
      setStatus("No face enrolled")
      return
    }
    if (!profile.location_id) {
      setStatus("No location assigned")
      return
    }

    // ดึง location ของผู้ใช้
    const { data: locs } = await supabase
      .from("locations")
      .select("*")
      .eq("id", profile.location_id)
      .single()

    if (!locs) {
      setStatus("Location not found")
      return
    }

    const distance = haversineDistanceM(latitude, longitude, locs.latitude, locs.longitude)
    if (distance > locs.radius_m) {
      setStatus(`You are ${Math.round(distance)}m away. Not allowed to punch here.`)
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

    const distanceScore = faceapi.euclideanDistance(
      detection.descriptor,
      new Float32Array(profile.face_embedding)
    )
    if (distanceScore > 0.6) {
      setStatus("Face does not match")
      return
    }

    const { error } = await supabase.from("time_punches").insert({
      user_id: user.id,
      location_id: profile.location_id,
      punch_type,
      lat: latitude,
      lng: longitude,
      distance_m: distance,
      face_score: distanceScore,
      created_at: new Date()
    })

    if (error) setStatus("Punch failed: " + error.message)
    else setStatus("Punch success!")

    fetchPunches(user.id)
  }

  return (
    <Layout>
     <div className="p-6 min-h-screen bg-gray-100">
  <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
  <p className="mb-4 text-gray-600">{status}</p>

  <div className="flex flex-wrap gap-2 mb-6">
    <button onClick={() => handlePunch("เข้าเช้า")} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">เข้าเช้า</button>
    <button onClick={() => handlePunch("ออกเที่ยง")} className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">ออกเที่ยง</button>
    <button onClick={() => handlePunch("เข้าบ่าย")} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">เข้าบ่าย</button>
    <button onClick={() => handlePunch("ออกเย็น")} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">ออกเย็น</button>
  </div>

  <h2 className="text-2xl font-semibold mb-2">ประวัติลงเวลา</h2>
  
  <table className="w-full border border-gray-300 rounded">
    <thead className="bg-gray-200">
      <tr>
        <th className="p-2 border">เวลา</th><th className="p-2 border">ประเภท</th><th className="p-2 border">Location</th>
      </tr>
    </thead>
    <tbody>
      {punches.map(p => (
        <tr key={p.id}>
          <td className="p-2 border">{new Date(p.created_at_th).toLocaleString()}</td>
          <td className="p-2 border">{p.punch_type}</td>
          <td className="p-2 border">{p.location_name}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

    </Layout>
  )
}
