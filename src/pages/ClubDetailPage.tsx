import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Star,
  Phone,
  Mail,
  Globe,
  MapPin,
  Search,
  Users,
  ChevronRight,
  Shield,
} from 'lucide-react'
import { MatchCard } from '../components/MatchCard'
import { FollowButton } from '../components/FollowButton'
import { StatusFilter } from '../components/StatusFilter'
import { SkeletonList, EmptyState, ErrorState } from '../components/Loading'
import { deptLabel, fetchClubs, PRATIQUE_LABELS, sortMatchesChrono } from '../lib/api'
import {
  clubCoreLabel,
  discoverClubTeams,
  filterMatchesForClub,
  filterMatchesForTeam,
  groupClubTeams,
  type ClubTeamInfo,
} from '../lib/clubTeams'
import { matchBucket, type MatchBucket } from '../lib/matchStore'
import type { Club, Match } from '../types'
import { clubFavId } from '../lib/favorites'
import { useFavorites } from '../hooks/useFavorites'
import { useSeason } from '../hooks/useSeason'
import { SeasonSelect } from '../components/SeasonSelect'

type Tab = 'equipes' | 'matchs' | 'contact'

export function ClubDetailPage() {
  const { id } = useParams()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { season } = useSeason()

  const [club, setClub] = useState<Club | null>(null)
  const [teams, setTeams] = useState<ClubTeamInfo[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('equipes')
  const [teamQuery, setTeamQuery] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<ClubTeamInfo | null>(null)
  const [bucket, setBucket] = useState<MatchBucket>('all')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      setSelectedTeam(null)
      setTeamQuery('')
      try {
        const clubs = await fetchClubs()
        const found = clubs.find((c) => c.id_club === id) || null
        if (cancelled) return
        setClub(found)
        if (!found) {
          setTeams([])
          setMatches([])
          return
        }
        const discovered = await discoverClubTeams(found, { saison: season })
        if (cancelled) return
        setTeams(discovered.teams)
        setMatches(filterMatchesForClub(discovered.matches, found.name))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [id, season])

  const fav = club ? isFavorite(clubFavId(club.id_club)) : false
  const phone = club?.telport || club?.telfixe
  const core = club ? clubCoreLabel(club.name) : ''

  const cityLine = useMemo(() => {
    if (!club) return ''
    return [club.adresse, club.cpostal, club.ville].filter(Boolean).join(', ') || deptLabel(club.id_dept)
  }, [club])

  const filteredTeams = useMemo(() => {
    const q = teamQuery.trim().toLowerCase()
    if (!q) return teams
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.base.toLowerCase().includes(q) ||
        t.meta.badge.toLowerCase().includes(q) ||
        t.meta.label.toLowerCase().includes(q) ||
        t.pouleName.toLowerCase().includes(q) ||
        (t.number && t.number.includes(q)),
    )
  }, [teams, teamQuery])

  const teamGroups = useMemo(() => groupClubTeams(filteredTeams), [filteredTeams])

  const visibleMatches = useMemo(() => {
    let list = matches
    if (selectedTeam) {
      list = filterMatchesForTeam(list, selectedTeam.name, selectedTeam.pouleCode)
    }
    if (bucket !== 'all') list = list.filter((m) => matchBucket(m.status) === bucket)
    return sortMatchesChrono(list, bucket === 'upcoming' ? 'asc' : 'desc')
  }, [matches, selectedTeam, bucket])

  const matchCounts = useMemo(() => {
    const base = selectedTeam
      ? filterMatchesForTeam(matches, selectedTeam.name, selectedTeam.pouleCode)
      : matches
    const c: Partial<Record<MatchBucket, number>> = {
      all: base.length,
      live: 0,
      upcoming: 0,
      past: 0,
    }
    base.forEach((m) => {
      const b = matchBucket(m.status)
      c[b] = (c[b] || 0) + 1
    })
    return c
  }, [matches, selectedTeam])

  if (loading) {
    return (
      <div className="page detail-page">
        <SkeletonList count={5} />
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          Chargement des équipes (régional + départemental)…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page detail-page">
        <ErrorState message={error} />
      </div>
    )
  }

  if (!club) {
    return (
      <div className="page detail-page">
        <Link to="/clubs" className="back-btn">
          <ArrowLeft size={16} /> Clubs
        </Link>
        <EmptyState title="Club introuvable" />
      </div>
    )
  }

  const initials = club.name
    .replace(/[^A-Za-zÀ-ÿ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="page detail-page">
      <div className="detail-top">
        <Link to="/clubs" className="back-btn">
          <ArrowLeft size={16} /> Clubs
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SeasonSelect variant="compact" showLabel={false} />
          <button
            type="button"
            className={`icon-btn${fav ? ' active' : ''}`}
            aria-label="Favori club"
            onClick={() =>
              toggleFavorite({
                id: clubFavId(club.id_club),
                kind: 'club',
                label: club.name,
                meta: club.ville || club.cpostal || deptLabel(club.id_dept),
              })
            }
          >
            <Star size={16} fill={fav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <SeasonSelect variant="chips" />

      <section className="club-hero">
        <div className="club-hero-glow" aria-hidden />
        <div className="club-hero-top">
          <div className="club-hero-avatar">{initials || 'VB'}</div>
          <div className="club-hero-text">
            <p className="club-hero-eyebrow">
              <Shield size={12} /> {deptLabel(club.id_dept)}
              {club.cpostal ? ` · ${club.cpostal}` : ''}
            </p>
            <h1>{club.name}</h1>
            {core && core !== normalizeLoose(club.name) && (
              <p className="club-hero-core">Équipes type « {titleCase(core)} »</p>
            )}
          </div>
        </div>

        {club.pratiques?.length > 0 && (
          <div className="pratique-tags" style={{ marginTop: 12 }}>
            {club.pratiques.map((p) => (
              <span className="tag" key={p}>
                {PRATIQUE_LABELS[p] || p}
              </span>
            ))}
          </div>
        )}

        <div className="club-hero-stats">
          <div>
            <strong>{teams.length}</strong>
            <span>compétition{teams.length > 1 ? 's' : ''}</span>
          </div>
          <div>
            <strong>{matches.length}</strong>
            <span>match{matches.length > 1 ? 's' : ''}</span>
          </div>
          <div>
            <strong>{matchCounts.upcoming || 0}</strong>
            <span>à venir</span>
          </div>
        </div>
        <p className="club-hero-core" style={{ marginTop: 10 }}>
          Saison {season}
        </p>
      </section>

      <div className="club-tabs" role="tablist">
        {(
          [
            ['equipes', 'Équipes', teams.length],
            ['matchs', 'Matchs', matches.length],
            ['contact', 'Contact', null],
          ] as const
        ).map(([idTab, label, count]) => (
          <button
            key={idTab}
            type="button"
            role="tab"
            aria-selected={tab === idTab}
            className={`club-tab${tab === idTab ? ' active' : ''}`}
            onClick={() => setTab(idTab)}
          >
            {label}
            {count != null && <span className="club-tab-count">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'equipes' && (
        <>
          <div className="search-bar">
            <Search size={18} />
            <input
              value={teamQuery}
              onChange={(e) => setTeamQuery(e.target.value)}
              placeholder="M18, féminin, équipe 3…"
              autoComplete="off"
            />
          </div>

          {teams.length === 0 ? (
            <EmptyState
              title="Aucune équipe trouvée"
              subtitle="Ce club n’a peut‑être pas d’équipes engagées en compétition FFVB cette saison, ou le nom fédéral diffère."
            />
          ) : filteredTeams.length === 0 ? (
            <EmptyState title="Aucun résultat" subtitle="Modifie ta recherche." />
          ) : (
            teamGroups.map((group) => (
              <div key={group.key} className="team-group">
                <div className="group-title team-group-title">
                  <span>{group.title}</span>
                  <span className="team-group-count">{group.teams.length}</span>
                </div>
                {group.teams.map((t) => (
                  <div key={t.id} className="card team-row">
                    <button
                      type="button"
                      className="team-row-main"
                      onClick={() => {
                        setSelectedTeam(t)
                        setTab('matchs')
                        setBucket('all')
                      }}
                    >
                      <div className="team-row-icon">
                        <Users size={16} />
                      </div>
                      <div className="team-row-body">
                        <div className="team-row-name">
                          {t.name}
                          {t.number ? (
                            <span className="team-num-pill">n°{t.number}</span>
                          ) : null}
                        </div>
                        <div className="team-row-badges">
                          <span
                            className={`comp-badge cat-${slug(t.meta.category)}`}
                            title={t.meta.label}
                          >
                            {t.meta.category}
                          </span>
                          {t.meta.gender && (
                            <span
                              className={`comp-badge ${t.meta.gender === 'F' ? 'gender-f' : 'gender-m'}`}
                            >
                              {t.meta.gender === 'F' ? 'Féminin' : 'Masculin'}
                            </span>
                          )}
                          {(t.meta.level || t.meta.phase) && (
                            <span className="comp-badge level">
                              {t.meta.level || t.meta.phase}
                            </span>
                          )}
                          {t.levelScope === 'departemental' && (
                            <span className="comp-badge scope-dept">Dépt.</span>
                          )}
                          {t.levelScope === 'national' && (
                            <span className="comp-badge scope-nat">Nat.</span>
                          )}
                        </div>
                        <div className="team-row-meta">
                          {t.pouleCode}
                          {t.pouleName && t.pouleName !== t.pouleCode
                            ? ` · ${shortPoule(t.pouleName)}`
                            : ''}
                          {t.matchCount > 0
                            ? ` · ${t.matchCount} match${t.matchCount > 1 ? 's' : ''}`
                            : ' · calendrier à venir'}
                        </div>
                      </div>
                      <ChevronRight size={18} className="team-row-chevron" />
                    </button>
                    <div className="team-row-actions">
                      <FollowButton
                        teamName={t.name}
                        meta={`${t.meta.badge}${t.meta.level ? ` · ${t.meta.level}` : ''}`}
                        size="sm"
                      />
                      <Link
                        to={`/equipe/${encodeURIComponent(t.name)}?poule=${encodeURIComponent(t.pouleCode)}&codent=${encodeURIComponent(t.codent)}`}
                        className="team-row-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Fiche
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </>
      )}

      {tab === 'matchs' && (
        <>
          {teams.length > 0 && (
            <div className="chips">
              <button
                type="button"
                className={`chip${selectedTeam === null ? ' active' : ''}`}
                onClick={() => setSelectedTeam(null)}
              >
                Toutes
              </button>
              {teams.slice(0, 16).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ghost${selectedTeam?.id === t.id ? ' active' : ''}`}
                  onClick={() => setSelectedTeam(t)}
                >
                  {t.meta.badge}
                  {t.number ? ` · ${t.number}` : ''}
                  {t.meta.level ? ` · ${shortLevel(t.meta.level)}` : ''}
                </button>
              ))}
            </div>
          )}

          <StatusFilter
            value={bucket}
            onChange={setBucket}
            counts={matchCounts}
            hideLive={!matchCounts.live}
          />

          {selectedTeam && (
            <div className="selected-team-banner">
              <span>
                Filtre : <strong>{selectedTeam.name}</strong>
                <span className="team-row-badges" style={{ display: 'inline-flex', marginLeft: 8 }}>
                  <span className="comp-badge">{selectedTeam.meta.badge}</span>
                  {selectedTeam.meta.level && (
                    <span className="comp-badge level">{selectedTeam.meta.level}</span>
                  )}
                </span>
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <FollowButton teamName={selectedTeam.name} showLabel size="sm" />
                <button type="button" className="text-btn" onClick={() => setSelectedTeam(null)}>
                  Tout voir
                </button>
              </div>
            </div>
          )}

          {visibleMatches.length === 0 ? (
            <EmptyState
              title="Aucun match"
              subtitle={
                selectedTeam
                  ? 'Pas de rencontre pour cette compétition avec ce filtre.'
                  : 'Aucun match strictement rattaché à ce club pour la saison.'
              }
            />
          ) : (
            visibleMatches.map((m) => (
              <MatchCard
                key={m.match_id}
                match={m}
                highlightTeams={
                  selectedTeam ? [selectedTeam.name] : teams.map((t) => t.name)
                }
              />
            ))
          )}
        </>
      )}

      {tab === 'contact' && (
        <div className="contact-list" style={{ marginTop: 4 }}>
          {cityLine && (
            <div className="contact-row">
              <MapPin size={18} />
              <span>{cityLine}</span>
            </div>
          )}
          {phone && (
            <a className="contact-row" href={`tel:${phone.replace(/\s/g, '')}`}>
              <Phone size={18} />
              <span>{phone}</span>
            </a>
          )}
          {club.email && (
            <a className="contact-row" href={`mailto:${club.email}`}>
              <Mail size={18} />
              <span>{club.email}</span>
            </a>
          )}
          {club.website && (
            <a
              className="contact-row"
              href={club.website.startsWith('http') ? club.website : `https://${club.website}`}
              target="_blank"
              rel="noreferrer"
            >
              <Globe size={18} />
              <span>{club.website}</span>
            </a>
          )}
          {!phone && !club.email && !club.website && !cityLine && (
            <EmptyState title="Pas de coordonnées" subtitle="Aucune info publique FFVolley." />
          )}
        </div>
      )}
    </div>
  )
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

function normalizeLoose(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
}

function shortPoule(name: string) {
  return name.replace(/^[A-Z0-9]+ - /, '').slice(0, 52)
}

function shortLevel(level: string) {
  return level
    .replace('Pré-nationale', 'PN')
    .replace('Régionale ', 'R')
    .replace('Départementale', 'Dép.')
    .replace('Accession régionale', 'Acc.')
    .replace('Nationale ', 'N')
}
