import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  BellOff,
  BellRing,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react'
import {
  ensureNotificationPermission,
  getNotifPrefs,
  notificationSupported,
  pushSupported,
  setNotifPrefs,
  showLocalNotification,
  subscribeWebPush,
  unsubscribeWebPush,
  type NotifPrefs,
  getVapidPublicKey,
} from '../lib/notifications'
import { followedTeamNames } from '../lib/notifications'
import { runMatchWatchCycle } from '../lib/matchWatcher'
import { useFavorites } from '../hooks/useFavorites'

export function NotificationsPage() {
  const { favorites } = useFavorites()
  const teams = favorites.filter((f) => f.kind === 'team')
  const [prefs, setPrefs] = useState<NotifPrefs>(() => getNotifPrefs())
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  )
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [pushOk, setPushOk] = useState<boolean | null>(null)
  const supported = notificationSupported()
  const canPush = pushSupported()

  useEffect(() => {
    getVapidPublicKey().then((k) => setPushOk(Boolean(k)))
  }, [])

  const save = (patch: Partial<NotifPrefs>) => {
    const next = setNotifPrefs(patch)
    setPrefs(next)
  }

  const enable = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const p = await ensureNotificationPermission()
      setPerm(p)
      if (p !== 'granted') {
        setMsg(
          'Permission refusée. Sur Android : icône cadenas → Notifications → Autoriser, puis réessaie.',
        )
        save({ enabled: false })
        return
      }
      save({ enabled: true })
      // Try web push (background) if VAPID available (Netlify prod)
      const sub = await subscribeWebPush()
      await showLocalNotification({
        title: 'Notifications activées',
        body: teams.length
          ? `Tu suis ${teams.length} équipe${teams.length > 1 ? 's' : ''}. On te prévient des résultats.`
          : 'Suis une équipe (★) pour recevoir ses résultats.',
        url: '/favoris',
        tag: 'vf-welcome',
      })
      setMsg(
        sub
          ? 'OK — push serveur + alertes locales activés (idéal Android).'
          : 'OK — alertes locales activées. Push serveur dispo après deploy Netlify avec clés VAPID.',
      )
      // Prime watcher once
      runMatchWatchCycle().catch(() => null)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur activation')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    try {
      await unsubscribeWebPush()
      save({ enabled: false })
      setMsg('Notifications désactivées.')
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    try {
      const ok = await showLocalNotification({
        title: 'Test VolleyFrance',
        body: 'Si tu vois ça, les notifs Android fonctionnent 🏐',
        url: '/favoris',
        tag: `test-${Date.now()}`,
      })
      setMsg(ok ? 'Notification de test envoyée.' : 'Impossible d’afficher la notif (permission ?).')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page detail-page">
      <Link to="/favoris" className="back-btn">
        <ArrowLeft size={16} /> Suivi
      </Link>

      <section className="notif-hero">
        <div className="notif-hero-icon">
          <BellRing size={28} />
        </div>
        <h1>Notifications</h1>
        <p>
          Priorité <strong>Android</strong> (Chrome / installer la PWA). Alerte quand une équipe
          suivie <strong>termine un match</strong>, avant le coup d’envoi, ou quand un match passe{' '}
          <strong>en cours</strong>.
        </p>
      </section>

      {!supported && (
        <div className="notif-banner warn">
          <AlertTriangle size={18} />
          Ton navigateur ne supporte pas les notifications.
        </div>
      )}

      <div className="panel">
        <h2 className="panel-title">État</h2>
        <div className="notif-status-grid">
          <StatusPill
            ok={perm === 'granted'}
            label="Permission"
            value={perm === 'granted' ? 'OK' : perm === 'denied' ? 'Refusée' : 'En attente'}
          />
          <StatusPill ok={prefs.enabled} label="Alertes" value={prefs.enabled ? 'ON' : 'OFF'} />
          <StatusPill
            ok={pushOk === true}
            label="Push serveur"
            value={pushOk === true ? 'Netlify OK' : pushOk === false ? 'Local only' : '…'}
          />
          <StatusPill
            ok={teams.length > 0}
            label="Équipes suivies"
            value={String(teams.length)}
          />
        </div>

        <div className="notif-actions">
          {!prefs.enabled ? (
            <button type="button" className="btn-primary" disabled={busy || !supported} onClick={enable}>
              <Bell size={18} /> Activer les notifications
            </button>
          ) : (
            <button type="button" className="btn-danger" disabled={busy} onClick={disable}>
              <BellOff size={18} /> Désactiver
            </button>
          )}
          <button type="button" className="btn-secondary" disabled={busy || !prefs.enabled} onClick={test}>
            Tester une notif
          </button>
        </div>
        {msg && <p className="notif-msg">{msg}</p>}
      </div>

      <div className="panel">
        <h2 className="panel-title">Types d’alertes</h2>
        <label className="notif-toggle">
          <div>
            <strong>Match terminé</strong>
            <span>Score final d’une équipe suivie</span>
          </div>
          <input
            type="checkbox"
            checked={prefs.onFinished}
            onChange={(e) => save({ onFinished: e.target.checked })}
          />
        </label>
        <label className="notif-toggle">
          <div>
            <strong>Rappel avant match</strong>
            <span>À venir dans l’heure (réglable)</span>
          </div>
          <input
            type="checkbox"
            checked={prefs.onUpcoming}
            onChange={(e) => save({ onUpcoming: e.target.checked })}
          />
        </label>
        {prefs.onUpcoming && (
          <label className="notif-select">
            <span>Délai du rappel</span>
            <select
              className="filter-select"
              value={prefs.upcomingMinutes}
              onChange={(e) => save({ upcomingMinutes: Number(e.target.value) })}
            >
              <option value={30}>30 minutes avant</option>
              <option value={60}>1 heure avant</option>
              <option value={120}>2 heures avant</option>
            </select>
          </label>
        )}
      </div>

      <div className="panel">
        <h2 className="panel-title">Équipes suivies ({teams.length})</h2>
        {teams.length === 0 ? (
          <p className="notif-hint">
            Aucune équipe. Va sur un match, appuie sur ★ <strong>Suivre</strong>, puis reviens ici.
          </p>
        ) : (
          <ul className="notif-team-list">
            {teams.map((t) => (
              <li key={t.id}>
                <CheckCircle2 size={16} />
                <span>{t.label}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/favoris" className="btn-secondary" style={{ display: 'inline-flex', marginTop: 12 }}>
          Gérer mon suivi
        </Link>
      </div>

      <div className="panel">
        <h2 className="panel-title">
          <Smartphone size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Android — conseillé
        </h2>
        <ol className="notif-steps">
          <li>Ouvre l’app dans <strong>Chrome</strong> (lien Netlify).</li>
          <li>
            Menu ⋮ → <strong>Installer l’application</strong> / Ajouter à l’écran d’accueil.
          </li>
          <li>Ouvre l’icône installée → active les notifs ici.</li>
          <li>Laisse Chrome / l’app autorisés (pas d’optimisation batterie agressive).</li>
        </ol>
        <div className="notif-banner info">
          <Info size={16} />
          <div>
            <strong>Local + serveur</strong>
            <p>
              Avec l’app ouverte ou récente : surveillance locale toutes les ~90 s.
              {canPush ? ' ' : ' '}
              Sur Netlify avec VAPID : un job périodique peut aussi pousser une notif même si
              l’app est fermée.
            </p>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Données fédé / temps réel ?</h2>
        <p className="notif-hint" style={{ marginBottom: 0 }}>
          On consomme les <strong>mêmes sources publiques</strong> que beaucoup d’outils (résultats
          FFVB agrégés + livescore FFVolley). Ce n’est <strong>pas un flux officiel certifié
          FFVolley en direct seconde par seconde</strong> : les scores finaux arrivent en général
          peu après la saisie feuille de match / publication, et le live dépend des feuilles
          électroniques ouvertes. Les notifs « match fini » se basent sur le passage d’un match au
          statut terminé dans ces flux.
        </p>
      </div>
    </div>
  )
}

function StatusPill({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className={`notif-pill${ok ? ' ok' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

// silence unused
void followedTeamNames
