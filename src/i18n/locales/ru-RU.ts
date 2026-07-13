import enUS from './en-US';

const ruRU: typeof enUS = {
  ...enUS,
  tabs: { browse: 'Обзор', discover: 'Открытия', library: 'Библиотека', profile: 'Профиль' },
  common: { ...enUS.common, save: 'Сохранить', cancel: 'Отмена', back: 'Назад', reset: 'Сбросить', apply: 'Применить', edit: 'Изменить', delete: 'Удалить', loading: 'Загрузка...', search: 'Поиск', signIn: 'Войти' },
  languages: { title: 'Язык', subtitle: 'Выберите язык приложения. Данные фильмов и даты будут следовать этой настройке.', english: 'Английский', turkish: 'Турецкий', spanish: 'Испанский', korean: 'Корейский', arabic: 'Арабский', portuguese: 'Португальский', japanese: 'Японский', russian: 'Русский', german: 'Немецкий', french: 'Французский' },
  browse: { ...enUS.browse, searchPlaceholder: 'Искать фильмы', trending: 'В тренде', today: 'Сегодня', thisWeek: 'На этой неделе', tonightPick: 'Выбор на вечер', madeForYou: 'Для вас', nowPlaying: 'Сейчас в кино', upcoming: 'Скоро', ranked: 'Лучшие фильмы', searchEmptyTitle: 'Что вы ищете?', showAllResults: 'Показать все результаты', resultsCount: '{count} результатов' },
  activity: { ...enUS.activity, title: 'Активность', subtitle: 'Запросы в друзья и релизы из watchlist', unread: '{count} новых обновлений', signInTitle: 'Войдите для активности', emptyTitle: 'Активности пока нет', accept: 'Принять', decline: 'Отклонить', open: 'Открыть активность' },
  profile: { ...enUS.profile, editProfile: 'Редактировать профиль', edit: 'Изменить', setUp: 'Настройте профиль', favoriteFour: 'Четыре любимых', watched: 'Просмотрено', diary: 'Дневник', watchlist: 'Watchlist', average: 'Среднее', friends: 'Друзья', yourActivity: 'Ваша активность', favoriteGenres: 'Любимые жанры', favoriteFilms: 'Любимые фильмы', recentReviews: 'Недавние отзывы', seeAll: 'Все', name: 'Имя', username: 'Имя пользователя', bio: 'Био' },
  library: { logs: 'Записи', diary: 'Дневник', lists: 'Списки' },
};

export default ruRU;
