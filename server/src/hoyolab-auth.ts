// Login na HoYoLAB com e-mail e senha da HoYoverse, pelo mesmo endpoint do site oficial (account.hoyolab.com).
// A senha passa só pela memória deste pedido: é cifrada com a chave pública da HoYoverse, enviada e descartada.
// Nada de senha é salvo; guardamos só os cookies de leitura (ltuid_v2/ltoken_v2/ltmid_v2), cifrados.
// Se a HoYoverse pedir captcha (geetest), devolvemos os dados para a tela resolver e reenviar.
// Fluxo conforme o projeto open-source genshin.py.
import { constants, publicEncrypt } from 'node:crypto'
import type { HoyolabCookies } from './hoyolab'

const LOGIN_URL = 'https://sg-public-api.hoyolab.com/account/ma-passport/api/webLoginByPassword'
const LOGIN_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4PMS2JVMwBsOIrYWRluY
wEiFZL7Aphtm9z5Eu/anzJ09nB00uhW+ScrDWFECPwpQto/GlOJYCUwVM/raQpAj
/xvcjK5tNVzzK94mhk+j9RiQ+aWHaTXmOgurhxSp3YbwlRDvOgcq5yPiTz0+kSeK
ZJcGeJ95bvJ+hJ/UMP0Zx2qB5PElZmiKvfiNqVUk8A8oxLJdBB5eCpqWV6CUqDKQ
KSQP4sM0mZvQ1Sr4UcACVcYgYnCbTZMWhJTWkrNXqI8TMomekgny3y+d6NX/cFa6
6jozFIF4HCX5aW8bp8C8vq2tFvFbleQ/Q3CU56EWWKMrOcpmFtRmC18s9biZBVR/
8QIDAQAB
-----END PUBLIC KEY-----`

const encrypt = (text: string) =>
  publicEncrypt({ key: LOGIN_KEY, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(text, 'utf8')).toString('base64')

/** dados do captcha para a tela (geetest v3 ou v4) */
export interface CaptchaChallenge {
  sessionId: string
  version: 3 | 4
  gt: string
  challenge?: string
  newCaptcha?: number
  riskType?: string
}

/** resultado do captcha vindo da tela */
export type CaptchaResult = { sessionId: string } & Record<string, string>

export type HoyolabLoginResult =
  | { ok: true; cookies: HoyolabCookies }
  | { ok: false; captcha: CaptchaChallenge }

const ERRORS: Record<number, string> = {
  [-3208]: 'E-mail ou senha da HoYoverse incorretos.',
  [-3203]: 'Essa conta HoYoverse não existe. Confira o e-mail.',
  [-3202]: 'A conta HoYoverse está bloqueada por tentativas demais. Espere um pouco ou entre pelo site oficial.',
  [-3102]: 'O captcha não foi aceito. Tente de novo.',
  [-3006]: 'Muitas tentativas seguidas. Espere alguns minutos.',
  [-3104]: 'A HoYoverse recusou o login deste dispositivo. Tente de novo.',
}

export class HoyolabLoginError extends Error {}

function readSetCookies(res: Response): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';')
    const i = pair.indexOf('=')
    if (i > 0) out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim()
  }
  return out
}

export async function loginHoyolab(
  email: string,
  password: string,
  deviceId: string,
  captcha?: CaptchaResult,
): Promise<HoyolabLoginResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-rpc-app_id': 'c9oqaq3s3gu8',
    'x-rpc-client_type': '4',
    'x-rpc-device_id': deviceId,
    Origin: 'https://account.hoyolab.com',
    Referer: 'https://account.hoyolab.com/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  }
  if (captcha) {
    const { sessionId, ...data } = captcha
    headers['x-rpc-aigis'] = `${sessionId};${Buffer.from(JSON.stringify(data)).toString('base64')}`
  }

  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ account: encrypt(email.trim()), password: encrypt(password), token_type: 6 }),
    signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json().catch(() => ({}))

  if (json.retcode === -3101) {
    const aigis = JSON.parse(res.headers.get('x-rpc-aigis') ?? '{}')
    const data = typeof aigis.data === 'string' ? JSON.parse(aigis.data) : aigis.data ?? {}
    return {
      ok: false,
      captcha: {
        sessionId: aigis.session_id,
        version: data.risk_type || aigis.mmt_type === 2 ? 4 : 3,
        gt: data.gt,
        challenge: data.challenge,
        newCaptcha: data.new_captcha,
        riskType: data.risk_type,
      },
    }
  }
  if (json.retcode !== 0) {
    throw new HoyolabLoginError(ERRORS[json.retcode] ?? `A HoYoverse recusou o login (código ${json.retcode}).`)
  }

  const cookies = readSetCookies(res)
  if (!cookies.ltuid_v2 || !cookies.ltoken_v2) {
    throw new HoyolabLoginError('Login aceito, mas a HoYoverse não devolveu os cookies de leitura. Tente de novo.')
  }
  return { ok: true, cookies: { ltuid: cookies.ltuid_v2, ltoken: cookies.ltoken_v2, ltmid: cookies.ltmid_v2 } }
}
