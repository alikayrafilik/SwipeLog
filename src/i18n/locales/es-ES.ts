import enUS from './en-US';

const esES: typeof enUS = {
  ...enUS,
  tabs: { browse: 'Explorar', discover: 'Descubrir', library: 'Biblioteca', profile: 'Perfil' },
  common: { ...enUS.common, save: 'Guardar', cancel: 'Cancelar', back: 'Atrás', reset: 'Restablecer', apply: 'Aplicar', edit: 'Editar', delete: 'Eliminar', loading: 'Cargando...', search: 'Buscar', signIn: 'Iniciar sesión' },
  languages: { title: 'Idioma', subtitle: 'Elige el idioma de la app. Los datos de películas y fechas siguen este ajuste.', english: 'Inglés', turkish: 'Turco', spanish: 'Español', korean: 'Coreano', arabic: 'Árabe', portuguese: 'Portugués', japanese: 'Japonés', russian: 'Ruso', german: 'Alemán', french: 'Francés' },
  browse: { ...enUS.browse, searchPlaceholder: 'Buscar películas', trending: 'Tendencias', today: 'Hoy', thisWeek: 'Esta semana', tonightPick: 'Elección de esta noche', madeForYou: 'Hecho para ti', nowPlaying: 'En cartelera', upcoming: 'Próximos estrenos', ranked: 'Películas destacadas', searchEmptyTitle: '¿Qué buscas?', searchEmptySubtitle: 'Búsqueda con TMDB', showAllResults: 'Mostrar todos los resultados', resultsCount: '{count} resultados' },
  activity: { ...enUS.activity, title: 'Actividad', subtitle: 'Solicitudes de amistad y estrenos de tu lista', unread: '{count} novedades', signInTitle: 'Inicia sesión para ver actividad', emptyTitle: 'Aún no hay actividad', accept: 'Aceptar', decline: 'Rechazar', open: 'Abrir actividad' },
  profile: { ...enUS.profile, editProfile: 'Editar perfil', edit: 'Editar', setUp: 'Configura tu perfil', favoriteFour: 'Cuatro favoritos', watched: 'Vistas', diary: 'Diario', watchlist: 'Lista', average: 'Promedio', friends: 'Amigos', yourActivity: 'Tu actividad', favoriteGenres: 'Géneros favoritos', favoriteFilms: 'Películas favoritas', recentReviews: 'Reseñas recientes', seeAll: 'Ver todo', name: 'Nombre', username: 'Usuario', bio: 'Bio' },
  library: { logs: 'Registros', diary: 'Diario', lists: 'Listas' },
};

export default esES;
