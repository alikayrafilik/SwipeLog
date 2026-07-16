import enUS from './en-US';

const arSA: typeof enUS = {
  ...enUS,
  discover: { ...enUS.discover, title: 'اكتشف', reviewSession: 'مراجعة الجلسة', modes: { forYou: 'لك', trending: 'الرائج', hiddenGems: 'جواهر خفية', newReleases: 'إصدارات جديدة', nineties: 'التسعينيات' } },
  tabs: { browse: 'تصفح', discover: 'اكتشف', library: 'المكتبة', profile: 'الملف' },
  common: { ...enUS.common, save: 'حفظ', cancel: 'إلغاء', back: 'رجوع', reset: 'إعادة ضبط', apply: 'تطبيق', edit: 'تعديل', delete: 'حذف', loading: 'جار التحميل...', search: 'بحث', signIn: 'تسجيل الدخول' },
  languages: { title: 'اللغة', subtitle: 'اختر لغة التطبيق. بيانات الأفلام والتواريخ ستتبع هذا الخيار.', english: 'الإنجليزية', turkish: 'التركية', spanish: 'الإسبانية', korean: 'الكورية', arabic: 'العربية', portuguese: 'البرتغالية', japanese: 'اليابانية', russian: 'الروسية', german: 'الألمانية', french: 'الفرنسية' },
  browse: { ...enUS.browse, searchPlaceholder: 'ابحث عن أفلام', trending: 'الرائج', today: 'اليوم', thisWeek: 'هذا الأسبوع', tonightPick: 'اختيار الليلة', madeForYou: 'مخصص لك', nowPlaying: 'يعرض الآن', upcoming: 'أفلام قادمة', ranked: 'أفلام مصنفة', searchEmptyTitle: 'ما الذي تبحث عنه؟', showAllResults: 'عرض كل النتائج', resultsCount: '{count} نتيجة' },
  activity: { ...enUS.activity, title: 'النشاط', subtitle: 'طلبات الصداقة وإصدارات قائمة المشاهدة', unread: '{count} تحديثات جديدة', signInTitle: 'سجل الدخول لرؤية النشاط', emptyTitle: 'لا يوجد نشاط بعد', accept: 'قبول', decline: 'رفض', open: 'فتح النشاط' },
  profile: { ...enUS.profile, editProfile: 'تعديل الملف', edit: 'تعديل', setUp: 'إعداد ملفك', favoriteFour: 'الأربعة المفضلة', watched: 'شوهد', diary: 'اليوميات', watchlist: 'قائمة المشاهدة', average: 'المتوسط', friends: 'الأصدقاء', yourActivity: 'نشاطك', favoriteGenres: 'الأنواع المفضلة', favoriteFilms: 'الأفلام المفضلة', recentReviews: 'مراجعات حديثة', seeAll: 'عرض الكل', name: 'الاسم', username: 'اسم المستخدم', bio: 'نبذة' },
  library: { logs: 'السجلات', diary: 'اليوميات', lists: 'القوائم' },
};

export default arSA;
