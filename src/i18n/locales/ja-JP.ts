import enUS from './en-US';

const jaJP: typeof enUS = {
  ...enUS,
  tabs: { browse: 'ブラウズ', discover: '発見', library: 'ライブラリ', profile: 'プロフィール' },
  common: { ...enUS.common, save: '保存', cancel: 'キャンセル', back: '戻る', reset: 'リセット', apply: '適用', edit: '編集', delete: '削除', loading: '読み込み中...', search: '検索', signIn: 'ログイン' },
  languages: { title: '言語', subtitle: 'アプリの言語を選択します。映画データと日付もこの設定に従います。', english: '英語', turkish: 'トルコ語', spanish: 'スペイン語', korean: '韓国語', arabic: 'アラビア語', portuguese: 'ポルトガル語', japanese: '日本語', russian: 'ロシア語', german: 'ドイツ語', french: 'フランス語' },
  browse: { ...enUS.browse, searchPlaceholder: '映画を検索', trending: 'トレンド', today: '今日', thisWeek: '今週', tonightPick: '今夜のおすすめ', madeForYou: 'あなた向け', nowPlaying: '上映中', upcoming: '近日公開', ranked: 'ランキング映画', searchEmptyTitle: '何を探していますか？', showAllResults: 'すべての結果を表示', resultsCount: '{count} 件' },
  activity: { ...enUS.activity, title: 'アクティビティ', subtitle: '友達リクエストとウォッチリストの公開情報', unread: '{count} 件の新着', signInTitle: 'ログインしてアクティビティを見る', emptyTitle: 'まだアクティビティはありません', accept: '承認', decline: '拒否', open: 'アクティビティを開く' },
  profile: { ...enUS.profile, editProfile: 'プロフィール編集', edit: '編集', setUp: 'プロフィールを設定', favoriteFour: 'お気に入り4本', watched: '視聴済み', diary: '日記', watchlist: 'ウォッチリスト', average: '平均', friends: '友達', yourActivity: 'あなたのアクティビティ', favoriteGenres: '好きなジャンル', favoriteFilms: '好きな映画', recentReviews: '最近のレビュー', seeAll: 'すべて見る', name: '名前', username: 'ユーザー名', bio: '自己紹介' },
  library: { logs: 'ログ', diary: '日記', lists: 'リスト' },
};

export default jaJP;
