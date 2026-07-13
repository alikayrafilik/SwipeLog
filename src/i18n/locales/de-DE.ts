import enUS from './en-US';

const deDE: typeof enUS = {
  ...enUS,
  tabs: { browse: 'Stöbern', discover: 'Entdecken', library: 'Bibliothek', profile: 'Profil' },
  common: { ...enUS.common, save: 'Speichern', cancel: 'Abbrechen', back: 'Zurück', reset: 'Zurücksetzen', apply: 'Anwenden', edit: 'Bearbeiten', delete: 'Löschen', loading: 'Lädt...', search: 'Suchen', signIn: 'Anmelden' },
  languages: { title: 'Sprache', subtitle: 'Wähle die App-Sprache. Filmdaten und Datumsangaben folgen dieser Einstellung.', english: 'Englisch', turkish: 'Türkisch', spanish: 'Spanisch', korean: 'Koreanisch', arabic: 'Arabisch', portuguese: 'Portugiesisch', japanese: 'Japanisch', russian: 'Russisch', german: 'Deutsch', french: 'Französisch' },
  browse: { ...enUS.browse, searchPlaceholder: 'Filme suchen', trending: 'Trends', today: 'Heute', thisWeek: 'Diese Woche', tonightPick: 'Tipp für heute Abend', madeForYou: 'Für dich', nowPlaying: 'Jetzt im Kino', upcoming: 'Kommende Filme', ranked: 'Top-Filme', searchEmptyTitle: 'Wonach suchst du?', showAllResults: 'Alle Ergebnisse anzeigen', resultsCount: '{count} Ergebnisse' },
  activity: { ...enUS.activity, title: 'Aktivität', subtitle: 'Freundschaftsanfragen und Watchlist-Starts', unread: '{count} neue Updates', signInTitle: 'Für Aktivität anmelden', emptyTitle: 'Noch keine Aktivität', accept: 'Annehmen', decline: 'Ablehnen', open: 'Aktivität öffnen' },
  profile: { ...enUS.profile, editProfile: 'Profil bearbeiten', edit: 'Bearbeiten', setUp: 'Profil einrichten', favoriteFour: 'Lieblingsvier', watched: 'Gesehen', diary: 'Tagebuch', watchlist: 'Watchlist', average: 'Durchschnitt', friends: 'Freunde', yourActivity: 'Deine Aktivität', favoriteGenres: 'Lieblingsgenres', favoriteFilms: 'Lieblingsfilme', recentReviews: 'Neue Rezensionen', seeAll: 'Alle ansehen', name: 'Name', username: 'Benutzername', bio: 'Bio' },
  library: { logs: 'Logs', diary: 'Tagebuch', lists: 'Listen' },
};

export default deDE;
