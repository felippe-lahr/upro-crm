/*!
 * UProCRM — rastreamento de anúncios (Google Ads → WhatsApp)
 * Cole no site do negócio:
 *   <script src="https://SEU-DOMINIO/track.js" data-tenant="<slug>"></script>
 *
 * Se o visitante chegou de um clique do Google (tem ?gclid=...), guarda o
 * gclid/UTMs e faz os botões de WhatsApp do site passarem pelo redirecionador
 * /r/wa, que carrega o gclid até a conversa. Cobre:
 *   - links <a href="wa.me/..."> comuns;
 *   - botões que abrem via JavaScript (window.open), como plugins de chat
 *     (Social Chat/QLWAPP, etc.) e popups de formulário.
 * Se NÃO houver gclid (visitante orgânico), não mexe em nada.
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
  if (!stored || !stored.gclid) return // sem clique do Google → não mexe em nada

  // URL do redirecionador que carrega o gclid até a conversa.
  function trackedUrl() {
    var u = origin + '/r/wa?t=' + encodeURIComponent(tenant) + '&gclid=' + encodeURIComponent(stored.gclid)
    var keys = Object.keys(stored.utm || {})
    for (var i = 0; i < keys.length; i++) u += '&' + keys[i] + '=' + encodeURIComponent(stored.utm[keys[i]])
    return u
  }

  function isWhatsApp(u) {
    return typeof u === 'string' && /(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|whatsapp\.com\/send)/i.test(u)
  }

  // 3a) Reescreve links <a> de WhatsApp comuns.
  function rewriteAnchors() {
    var links = document.querySelectorAll(
      'a[href*="wa.me"], a[href*="api.whatsapp.com"], a[href*="whatsapp.com/send"], a[href*="web.whatsapp.com"]'
    )
    for (var i = 0; i < links.length; i++) {
      var a = links[i]
      if (a.getAttribute('data-upro')) continue
      a.setAttribute('href', trackedUrl())
      a.setAttribute('data-upro', '1')
    }
  }
  rewriteAnchors()
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rewriteAnchors)
  try { new MutationObserver(rewriteAnchors).observe(document.documentElement, { childList: true, subtree: true }) } catch (e) {}

  // 3b) Intercepta botões que abrem via JavaScript (window.open) — plugins de chat,
  // popups de formulário, etc. Se o destino for o WhatsApp, troca pela URL rastreada.
  var _open = window.open
  window.open = function (u) {
    if (isWhatsApp(u)) {
      arguments[0] = trackedUrl()
    }
    return _open.apply(window, arguments)
  }
})()
