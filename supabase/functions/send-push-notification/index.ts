import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// APNs Configuration
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID')! // e.g., 'P2VYL2J92Y'
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID')! // e.g., 'KLXF6GTQ85'
const APNS_KEY = Deno.env.get('APNS_KEY')! // .p8 file content
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') || 'com.maniasstudio.jarvis'
const APNS_ENDPOINT = Deno.env.get('APNS_ENDPOINT') || 'https://api.push.apple.com' // or sandbox

interface NotificationPayload {
  user_id?: string
  device_token?: string
  title: string
  body: string
  data?: Record<string, any>
  badge?: number
  sound?: string
}

serve(async (req) => {
  try {
    const payload: NotificationPayload = await req.json()
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Get device tokens
    let deviceTokens: string[] = []
    
    if (payload.device_token) {
      deviceTokens = [payload.device_token]
    } else if (payload.user_id) {
      const { data: devices } = await supabase
        .from('user_devices')
        .select('device_token')
        .eq('user_id', payload.user_id)
        .eq('platform', 'ios')
      
      deviceTokens = devices?.map(d => d.device_token) || []
    }
    
    if (deviceTokens.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No device tokens found' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Send to APNs
    const results = await Promise.all(
      deviceTokens.map(token => sendToAPNs(token, payload))
    )
    
    // Update last_notification_at
    if (payload.user_id) {
      await supabase
        .from('user_devices')
        .update({ last_notification_at: new Date().toISOString() })
        .eq('user_id', payload.user_id)
    }
    
    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function sendToAPNs(deviceToken: string, payload: NotificationPayload) {
  // Generate JWT for APNs authentication
  const jwt = await generateAPNsJWT()
  
  const notification = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body
      },
      badge: payload.badge || 1,
      sound: payload.sound || 'default'
    },
    data: payload.data || {}
  }
  
  const response = await fetch(
    `${APNS_ENDPOINT}/3/device/${deviceToken}`,
    {
      method: 'POST',
      headers: {
        'authorization': `bearer ${jwt}`,
        'apns-topic': APNS_BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority': '10'
      },
      body: JSON.stringify(notification)
    }
  )
  
  return {
    deviceToken,
    status: response.status,
    success: response.ok
  }
}

async function generateAPNsJWT() {
  // TODO: Implement JWT generation for APNs
  // This requires crypto library for ES256 signing
  // For now, placeholder - needs implementation
  return 'PLACEHOLDER_JWT'
}
