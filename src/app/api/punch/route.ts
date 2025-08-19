import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { haversineDistanceM } from '@/lib/distance'

export async function POST(req: NextRequest) {
  try {
    const { locationId, lat, lng, embedding, punchType, userId } = await req.json()

    // 1) ดึง location จาก DB
    const { data: location } = await supabase
      .from('locations')
      .select('*')
      .eq('id', locationId)
      .single()

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // 2) คำนวณระยะ
    const distance = haversineDistanceM(lat, lng, location.latitude, location.longitude)
    if (distance > location.radius_m) {
      return NextResponse.json({ error: 'Out of range', distance }, { status: 403 })
    }

    // 3) ดึง embedding ของ user
    const { data: profile } = await supabase
      .from('users_profile')
      .select('face_embedding')
      .eq('user_id', userId)
      .single()

    if (!profile?.face_embedding) {
      return NextResponse.json({ error: 'No face enrolled' }, { status: 400 })
    }

    // 4) คำนวณ similarity
    function cosineSim(a: number[], b: number[]) {
      const dot = a.reduce((s, v, i) => s + v * b[i], 0)
      const normA = Math.sqrt(a.reduce((s, v) => s + v*v, 0))
      const normB = Math.sqrt(b.reduce((s, v) => s + v*v, 0))
      return dot / (normA * normB)
    }
    const faceScore = cosineSim(embedding, profile.face_embedding)

    if (faceScore < 0.55) {
      return NextResponse.json({ error: 'Face not match', faceScore }, { status: 403 })
    }

    // 5) Insert punch
    const { data, error } = await supabase.from('time_punches').insert({
      user_id: userId,
      location_id: locationId,
      punch_type: punchType,
      lat, lng,
      distance_m: distance,
      face_score: faceScore
    }).select('*').single()

    if (error) throw error

    return NextResponse.json({ ok: true, punch: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
