import enUS from './en-US';

const ptBR: typeof enUS = {
  ...enUS,
  tabs: { browse: 'Explorar', discover: 'Descobrir', library: 'Biblioteca', profile: 'Perfil' },
  common: { ...enUS.common, save: 'Salvar', cancel: 'Cancelar', back: 'Voltar', reset: 'Redefinir', apply: 'Aplicar', edit: 'Editar', delete: 'Excluir', loading: 'Carregando...', search: 'Buscar', signIn: 'Entrar' },
  languages: { title: 'Idioma', subtitle: 'Escolha o idioma do app. Dados de filmes e datas seguem essa configuração.', english: 'Inglês', turkish: 'Turco', spanish: 'Espanhol', korean: 'Coreano', arabic: 'Árabe', portuguese: 'Português', japanese: 'Japonês', russian: 'Russo', german: 'Alemão', french: 'Francês' },
  browse: { ...enUS.browse, searchPlaceholder: 'Buscar filmes', trending: 'Em alta', today: 'Hoje', thisWeek: 'Esta semana', tonightPick: 'Escolha da noite', madeForYou: 'Feito para você', nowPlaying: 'Em cartaz', upcoming: 'Próximos filmes', ranked: 'Filmes em destaque', searchEmptyTitle: 'O que você procura?', showAllResults: 'Mostrar todos os resultados', resultsCount: '{count} resultados' },
  activity: { ...enUS.activity, title: 'Atividade', subtitle: 'Pedidos de amizade e lançamentos da watchlist', unread: '{count} novidades', signInTitle: 'Entre para ver atividade', emptyTitle: 'Ainda sem atividade', accept: 'Aceitar', decline: 'Recusar', open: 'Abrir atividade' },
  profile: { ...enUS.profile, editProfile: 'Editar perfil', edit: 'Editar', setUp: 'Configure seu perfil', favoriteFour: 'Quatro favoritos', watched: 'Assistidos', diary: 'Diário', watchlist: 'Watchlist', average: 'Média', friends: 'Amigos', yourActivity: 'Sua atividade', favoriteGenres: 'Gêneros favoritos', favoriteFilms: 'Filmes favoritos', recentReviews: 'Avaliações recentes', seeAll: 'Ver tudo', name: 'Nome', username: 'Usuário', bio: 'Bio' },
  library: { logs: 'Registros', diary: 'Diário', lists: 'Listas' },
};

export default ptBR;
