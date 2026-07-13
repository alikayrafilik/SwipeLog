import enUS from './en-US';

const frFR: typeof enUS = {
  ...enUS,
  tabs: { browse: 'Parcourir', discover: 'Découvrir', library: 'Bibliothèque', profile: 'Profil' },
  common: { ...enUS.common, save: 'Enregistrer', cancel: 'Annuler', back: 'Retour', reset: 'Réinitialiser', apply: 'Appliquer', edit: 'Modifier', delete: 'Supprimer', loading: 'Chargement...', search: 'Rechercher', signIn: 'Se connecter' },
  languages: { title: 'Langue', subtitle: "Choisis la langue de l'app. Les films et les dates suivent ce réglage.", english: 'Anglais', turkish: 'Turc', spanish: 'Espagnol', korean: 'Coréen', arabic: 'Arabe', portuguese: 'Portugais', japanese: 'Japonais', russian: 'Russe', german: 'Allemand', french: 'Français' },
  browse: { ...enUS.browse, searchPlaceholder: 'Rechercher des films', trending: 'Tendances', today: "Aujourd'hui", thisWeek: 'Cette semaine', tonightPick: 'Choix du soir', madeForYou: 'Pour toi', nowPlaying: "À l'affiche", upcoming: 'Prochainement', ranked: 'Films classés', searchEmptyTitle: 'Que cherches-tu ?', showAllResults: 'Afficher tous les résultats', resultsCount: '{count} résultats' },
  activity: { ...enUS.activity, title: 'Activité', subtitle: "Demandes d'amis et sorties de ta watchlist", unread: '{count} nouveautés', signInTitle: "Connecte-toi pour l'activité", emptyTitle: "Pas encore d'activité", accept: 'Accepter', decline: 'Refuser', open: "Ouvrir l'activité" },
  profile: { ...enUS.profile, editProfile: 'Modifier le profil', edit: 'Modifier', setUp: 'Configurer ton profil', favoriteFour: 'Quatre favoris', watched: 'Vus', diary: 'Journal', watchlist: 'Watchlist', average: 'Moyenne', friends: 'Amis', yourActivity: 'Ton activité', favoriteGenres: 'Genres favoris', favoriteFilms: 'Films favoris', recentReviews: 'Avis récents', seeAll: 'Tout voir', name: 'Nom', username: "Nom d'utilisateur", bio: 'Bio' },
  library: { logs: 'Films vus', diary: 'Journal', lists: 'Listes' },
};

export default frFR;
