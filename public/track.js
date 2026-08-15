/*!
 * UProCRM — rastreamento de anúncios (Google Ads → WhatsApp)
 * Cole no site do negócio:
 *   <script src="https://SEU-DOMINIO/track.js" data-tenant="<slug>"></script>
 *
 * O que faz: se o visitante chegou de um clique do Google (tem ?gclid=...),
 * guarda o gclid/UTMs e reescreve os botões de WhatsApp do site para passar
 * pelo redirecionador /r/wa, que carrega o gclid até a conversa. Se NÃO houver
 * gclid (visitante orgânico), não mexe em nada — os botões seguem normais.
 */
(function () {
  var s = document.currentScript
  if (!s) return
  var tenant = s.getAttribute('data-tenant')
  if (!tenant) return

  var origin
  try { origin = new URL(s.src).origin } catch (e) { return }

  var KEY = 'upro_ads'
  var MAXAGE = 90 * 24 * 60 * 60 * 1000 // 90 dias
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']

  // 1) Captura o gclid/UTMs desta visita (o Google anexa ?gclid= com auto-tagging).
  var params = new URLSearchParams(location.search)
  var gclid = params.get('gclid')
  if (gclid) {
    var utm = {}
    UTM.forEach(function (k) { var v = params.get(k); if (v) utm[k] = v })
    try { localStorage.setItem(KEY, JSON.stringify({ gclid: gclid, utm: utm, t: Date.now() })) } catch (e) {}
  }

  // 2) Recupera o clique guardado (dentro da janela de 90 dias).
  var stored = null
  try { stored = JSON.parse(localStorage.getItem(KEY) || 'null') } catch (e) {}
  if (stored && (Date.now() - stored.t) > MAXAGE) stored = null
  if (!stored || !stored.gclid) return // sem clique do Google → não mexe nos botões

  // 3) Reescreve os botões de WhatsApp para passar pelo /r/wa levando o gclid.
  function rewrite() {
    var links = document.querySelectorAll(
      'a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp.com/send"]'
    )
    for (var i = 0; i < links.length; i++) {
      var a = links[i]
      if (a.getAttribute('data-upro')) continue
      var u = origin + '/r/wa?t=' + encodeURIComponent(tenant) + '&gclid=' + encodeURIComponent(stored.gclid)
      var keys = Object.keys(stored.utm || {})
      for (var j = 0; j < keys.length; j++) u += '&' + keys[j] + '=' + encodeURIComponent(stored.utm[keys[j]])
      a.setAttribute('href', u)
      a.setAttribute('data-upro', '1')
    }
  }

  rewrite()
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rewrite)
  // Botões carregados dinamicamente (plugins de WhatsApp) também são cobertos.
  try { new MutationObserver(rewrite).observe(document.documentElement, { childList: true, subtree: true }) } catch (e) {}
})()
