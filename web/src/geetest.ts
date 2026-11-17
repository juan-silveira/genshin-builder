// Captcha da HoYoverse (geetest), o mesmo do site oficial. O script vem do servidor oficial do geetest.
import type { CaptchaChallenge } from './api'

declare global {
  interface Window { initGeetest?: any; initGeetest4?: any }
}

const SCRIPTS = { 3: 'https://static.geetest.com/static/js/gt.0.5.0.js', 4: 'https://static.geetest.com/v4/gt4.js' }

function loadScript(src: string) {
  return new Promise<void>((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok()
    const s = document.createElement('script')
    s.src = src
    s.referrerPolicy = 'no-referrer'
    s.onload = () => ok()
    s.onerror = () => fail(new Error('Não consegui carregar o captcha. Confira a internet e tente de novo.'))
    document.head.appendChild(s)
  })
}

/** mostra o captcha e devolve o resultado para reenviar o login */
export async function solveCaptcha(c: CaptchaChallenge): Promise<Record<string, string>> {
  await loadScript(SCRIPTS[c.version])
  return new Promise((ok, fail) => {
    const done = (captcha: any) => {
      captcha.onReady(() => (c.version === 3 ? captcha.verify() : captcha.showCaptcha()))
      captcha.onSuccess(() => ok({ sessionId: c.sessionId, ...captcha.getValidate() }))
      captcha.onError(() => fail(new Error('O captcha deu erro. Tente de novo.')))
      captcha.onClose?.(() => fail(new Error('Captcha fechado. Tente de novo quando quiser.')))
    }
    if (c.version === 3) {
      window.initGeetest({
        gt: c.gt, challenge: c.challenge, new_captcha: c.newCaptcha, api_server: 'api-na.geetest.com',
        https: true, product: 'bind', lang: 'pt-br',
      }, done)
    } else {
      window.initGeetest4({
        captchaId: c.gt, riskType: c.riskType, product: 'bind', language: 'pt-br',
        userInfo: JSON.stringify({ mmt_key: c.sessionId }),
      }, done)
    }
  })
}
