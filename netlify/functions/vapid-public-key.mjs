import { getVapid, json, cors } from './_shared.mjs'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() }
  }
  const { publicKey } = getVapid()
  if (!publicKey) {
    return json(404, {
      error: 'VAPID non configuré',
      hint: 'Ajoute VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans Netlify → Site settings → Environment variables',
    })
  }
  return json(200, { publicKey })
}
