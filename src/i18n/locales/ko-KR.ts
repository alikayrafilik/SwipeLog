import enUS from './en-US';

const koKR: typeof enUS = {
  ...enUS,
  discover: { ...enUS.discover, title: '발견', reviewSession: '세션 검토', modes: { forYou: '맞춤 추천', trending: '인기', hiddenGems: '숨은 명작', newReleases: '신작', nineties: '90년대' } },
  tabs: { browse: '둘러보기', discover: '발견', library: '라이브러리', profile: '프로필' },
  common: { ...enUS.common, save: '저장', cancel: '취소', back: '뒤로', reset: '초기화', apply: '적용', edit: '편집', delete: '삭제', loading: '불러오는 중...', search: '검색', signIn: '로그인' },
  languages: { title: '언어', subtitle: '앱 언어를 선택하세요. 영화 데이터와 날짜도 이 설정을 따릅니다.', english: '영어', turkish: '튀르키예어', spanish: '스페인어', korean: '한국어', arabic: '아랍어', portuguese: '포르투갈어', japanese: '일본어', russian: '러시아어', german: '독일어', french: '프랑스어' },
  browse: { ...enUS.browse, searchPlaceholder: '영화 검색', trending: '인기', today: '오늘', thisWeek: '이번 주', tonightPick: '오늘 밤 추천', madeForYou: '맞춤 추천', nowPlaying: '상영 중', upcoming: '개봉 예정', ranked: '랭킹 영화', searchEmptyTitle: '무엇을 찾고 있나요?', showAllResults: '모든 결과 보기', resultsCount: '{count}개 결과' },
  activity: { ...enUS.activity, title: '활동', subtitle: '친구 요청과 워치리스트 개봉 알림', unread: '새 업데이트 {count}개', signInTitle: '활동을 보려면 로그인', emptyTitle: '아직 활동이 없습니다', accept: '수락', decline: '거절', open: '활동 열기' },
  profile: { ...enUS.profile, editProfile: '프로필 편집', edit: '편집', setUp: '프로필 설정', favoriteFour: '최애 4편', watched: '본 영화', diary: '다이어리', watchlist: '워치리스트', average: '평균', friends: '친구', yourActivity: '내 활동', favoriteGenres: '좋아하는 장르', favoriteFilms: '좋아하는 영화', recentReviews: '최근 리뷰', seeAll: '전체 보기', name: '이름', username: '사용자 이름', bio: '소개' },
  library: { logs: '기록', diary: '다이어리', lists: '리스트' },
};

export default koKR;
