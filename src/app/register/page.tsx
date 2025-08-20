"use client"

import { useState, useRef, useEffect } from "react"
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
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [showAddLocation, setShowAddLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const [faceCaptured, setFaceCaptured] = useState(false)
  const [faceEmbedding, setFaceEmbedding] = useState<Float32Array | null>(null)
  const [newLocationLatitude, setNewLocationLatitude] = useState<number | null>(null)
  const [newLocationLongitude, setNewLocationLongitude] = useState<number | null>(null)
  const [newLocationRadius, setNewLocationRadius] = useState<number>(200) // default 50m

  // โหลด locations จากฐานข้อมูล
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase.from("locations").select("id, name")
      if (data) setLocations(data)
    }
    fetchLocations()
  }, [])

  const handleUseCurrentLocation = async () => {
  try {
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    )
    setNewLocationLatitude(pos.coords.latitude)
    setNewLocationLongitude(pos.coords.longitude)
    setStatus("Current location captured")
  } catch (err) {
    setStatus("Failed to get current location")
  }
}

const handleAddLocation = async () => {
  if (!newLocationName.trim()) {
    setStatus("Location name required")
    return
  }
  if (newLocationLatitude === null || newLocationLongitude === null) {
    setStatus("Please set location coordinates")
    return
  }

  const { data, error } = await supabase
    .from("locations")
    .insert({
      name: newLocationName,
      latitude: newLocationLatitude,
      longitude: newLocationLongitude,
      radius_m: newLocationRadius,
    })
    .select("id, name")
    .single()

  if (error) {
    setStatus("Failed to add location: " + error.message)
    return
  }

  setLocations([...locations, data])
  setSelectedLocation(data.id)
  setNewLocationName("")
  setNewLocationLatitude(null)
  setNewLocationLongitude(null)
  setNewLocationRadius(50)
  setShowAddLocation(false)
  setStatus("Location added successfully")
}

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!faceCaptured || !faceEmbedding) {
      setStatus("Please capture your face first")
      return
    }
    if (!selectedLocation) {
      setStatus("Please select a location")
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

    const { error: profileError } = await supabase.from("users_profile").insert({
      user_id: data.user?.id,
      full_name: name,
      face_embedding: Array.from(faceEmbedding),
      location_id: selectedLocation,
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

          <div className="flex gap-2">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              required
              className="flex-1 px-4 py-2 border rounded"
            >
              <option value="">Select your location</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="px-3 py-2 bg-gray-300 rounded hover:bg-gray-400"
              onClick={() => setShowAddLocation(true)}
            >
              +
            </button>
          </div>

          {showAddLocation && (
            <div className="flex flex-col gap-2">
               <input
              type="text"
              placeholder="New location name"
             value={newLocationName}
             onChange={(e) => setNewLocationName(e.target.value)}
             className="px-4 py-2 border rounded"
            />

           <div className="flex gap-2">
           <input
            type="number"
            placeholder="Radius (meters)"
            value={newLocationRadius}
            onChange={(e) => setNewLocationRadius(Number(e.target.value))}
            className="flex-1 px-4 py-2 border rounded"
              />

                 <button
                type="button"
               className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
               onClick={handleUseCurrentLocation}
                >
                <img src="/vercel.svg" alt="Use Current Location" className="h-5 w-5" />
                </button>
              </div>

                <div className="flex gap-2">
              <button
                  type="button"
               className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
             onClick={handleAddLocation}
      >
                 Add
                  </button>
                <button
                   type="button"
                   className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  onClick={() => setShowAddLocation(false)}
      >
                          Cancel
                         </button>
                         </div>
                        </div>
                                )}


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
