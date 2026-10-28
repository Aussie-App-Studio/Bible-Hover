/**
 * Bible Hover — Canonical Metadata, Book Aliases, & High-Precision Reference Parser
 * Zero dependencies. Runs in both Content Scripts and Background Service Worker.
 */
(function (root) {
  'use strict';

  const BOOKS = [
    {
      id: 1, code: 'Gen', name: 'Genesis',
      aliases: ['genesis', 'gen', 'ge', 'gn'],
      chapters: [31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26]
    },
    {
      id: 2, code: 'Exo', name: 'Exodus',
      aliases: ['exodus', 'exod', 'exo', 'ex'],
      chapters: [22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38]
    },
    {
      id: 3, code: 'Lev', name: 'Leviticus',
      aliases: ['leviticus', 'levit', 'lev', 'le', 'lv'],
      chapters: [17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34]
    },
    {
      id: 4, code: 'Num', name: 'Numbers',
      aliases: ['numbers', 'numb', 'num', 'nu', 'nm', 'nb'],
      chapters: [54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13]
    },
    {
      id: 5, code: 'Deu', name: 'Deuteronomy',
      aliases: ['deuteronomy', 'deut', 'deu', 'dt'],
      chapters: [46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12]
    },
    {
      id: 6, code: 'Jos', name: 'Joshua',
      aliases: ['joshua', 'josh', 'jos', 'jsh'],
      chapters: [18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33]
    },
    {
      id: 7, code: 'Jdg', name: 'Judges',
      aliases: ['judges', 'judg', 'jdg', 'jg', 'jdgs'],
      chapters: [36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25]
    },
    {
      id: 8, code: 'Rth', name: 'Ruth',
      aliases: ['ruth', 'rth', 'ru'],
      chapters: [22,23,18,22]
    },
    {
      id: 9, code: '1Sa', name: '1 Samuel',
      aliases: ['1 samuel', '1 sam', '1 sa', '1sam', '1sa', '1 sm', '1sm', '1st samuel', '1st sam', 'first samuel', 'first sam', 'i samuel', 'i sam', 'i sa'],
      chapters: [28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13]
    },
    {
      id: 10, code: '2Sa', name: '2 Samuel',
      aliases: ['2 samuel', '2 sam', '2 sa', '2sam', '2sa', '2 sm', '2sm', '2nd samuel', '2nd sam', 'second samuel', 'second sam', 'ii samuel', 'ii sam', 'ii sa'],
      chapters: [27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25]
    },
    {
      id: 11, code: '1Ki', name: '1 Kings',
      aliases: ['1 kings', '1 king', '1 kgs', '1 ki', '1kings', '1kgs', '1ki', '1 kin', '1kin', '1st kings', 'first kings', 'i kings', 'i kgs', 'i ki'],
      chapters: [53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53]
    },
    {
      id: 12, code: '2Ki', name: '2 Kings',
      aliases: ['2 kings', '2 king', '2 kgs', '2 ki', '2kings', '2kgs', '2ki', '2 kin', '2kin', '2nd kings', 'second kings', 'ii kings', 'ii kgs', 'ii ki'],
      chapters: [18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30]
    },
    {
      id: 13, code: '1Ch', name: '1 Chronicles',
      aliases: ['1 chronicles', '1 chron', '1 chr', '1 ch', '1chronicles', '1chron', '1chr', '1ch', '1st chronicles', 'first chronicles', 'i chronicles', 'i chron', 'i chr'],
      chapters: [54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30]
    },
    {
      id: 14, code: '2Ch', name: '2 Chronicles',
      aliases: ['2 chronicles', '2 chron', '2 chr', '2 ch', '2chronicles', '2chron', '2chr', '2ch', '2nd chronicles', 'second chronicles', 'ii chronicles', 'ii chron', 'ii chr'],
      chapters: [17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23]
    },
    {
      id: 15, code: 'Ezr', name: 'Ezra',
      aliases: ['ezra', 'ezr', 'ez'],
      chapters: [11,70,13,24,17,22,28,36,15,44]
    },
    {
      id: 16, code: 'Neh', name: 'Nehemiah',
      aliases: ['nehemiah', 'neh', 'ne'],
      chapters: [11,20,32,23,19,19,73,18,38,39,36,47,31]
    },
    {
      id: 17, code: 'Est', name: 'Esther',
      aliases: ['esther', 'esth', 'est', 'es'],
      chapters: [22,23,15,17,14,14,10,17,32,3]
    },
    {
      id: 18, code: 'Job', name: 'Job',
      aliases: ['job', 'jb'],
      chapters: [22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17]
    },
    {
      id: 19, code: 'Psa', name: 'Psalms',
      aliases: ['psalms', 'psalm', 'pslm', 'psa', 'psm', 'pss', 'ps'],
      chapters: [6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,10,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6]
    },
    {
      id: 20, code: 'Pro', name: 'Proverbs',
      aliases: ['proverbs', 'proverb', 'prov', 'pro', 'prv', 'pr'],
      chapters: [33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31]
    },
    {
      id: 21, code: 'Ecc', name: 'Ecclesiastes',
      aliases: ['ecclesiastes', 'eccles', 'eccl', 'ecc', 'ec', 'qoh'],
      chapters: [18,26,22,16,20,12,29,17,18,20,10,14]
    },
    {
      id: 22, code: 'Sng', name: 'Song of Solomon',
      aliases: ['song of solomon', 'song of songs', 'songs', 'song', 'sos', 'sng', 'canticle of canticles', 'canticles', 'cant'],
      chapters: [17,17,11,16,16,13,13,14]
    },
    {
      id: 23, code: 'Isa', name: 'Isaiah',
      aliases: ['isaiah', 'isa', 'is'],
      chapters: [31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24]
    },
    {
      id: 24, code: 'Jer', name: 'Jeremiah',
      aliases: ['jeremiah', 'jer', 'je', 'jr'],
      chapters: [19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34]
    },
    {
      id: 25, code: 'Lam', name: 'Lamentations',
      aliases: ['lamentations', 'lam', 'la'],
      chapters: [22,22,66,22,22]
    },
    {
      id: 26, code: 'Eze', name: 'Ezekiel',
      aliases: ['ezekiel', 'ezek', 'eze', 'ezk'],
      chapters: [28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35]
    },
    {
      id: 27, code: 'Dan', name: 'Daniel',
      aliases: ['daniel', 'dan', 'da', 'dn'],
      chapters: [21,49,30,37,31,28,28,27,27,21,45,13]
    },
    {
      id: 28, code: 'Hos', name: 'Hosea',
      aliases: ['hosea', 'hos', 'ho'],
      chapters: [11,23,5,19,15,11,16,14,17,15,12,14,16,9]
    },
    {
      id: 29, code: 'Joe', name: 'Joel',
      aliases: ['joel', 'joe', 'jl'],
      chapters: [20,32,21]
    },
    {
      id: 30, code: 'Amo', name: 'Amos',
      aliases: ['amos', 'amo', 'am'],
      chapters: [15,16,15,13,27,14,17,14,15]
    },
    {
      id: 31, code: 'Oba', name: 'Obadiah',
      aliases: ['obadiah', 'obad', 'oba', 'ob'],
      chapters: [21]
    },
    {
      id: 32, code: 'Jon', name: 'Jonah',
      aliases: ['jonah', 'jnh', 'jon'],
      chapters: [17,10,10,11]
    },
    {
      id: 33, code: 'Mic', name: 'Micah',
      aliases: ['micah', 'mic', 'mc'],
      chapters: [16,13,12,13,15,16,20]
    },
    {
      id: 34, code: 'Nah', name: 'Nahum',
      aliases: ['nahum', 'nah', 'na'],
      chapters: [15,13,19]
    },
    {
      id: 35, code: 'Hab', name: 'Habakkuk',
      aliases: ['habakkuk', 'hab', 'hb'],
      chapters: [17,20,19]
    },
    {
      id: 36, code: 'Zep', name: 'Zephaniah',
      aliases: ['zephaniah', 'zeph', 'zep', 'zp'],
      chapters: [18,15,20]
    },
    {
      id: 37, code: 'Hag', name: 'Haggai',
      aliases: ['haggai', 'hag', 'hg'],
      chapters: [15,23]
    },
    {
      id: 38, code: 'Zec', name: 'Zechariah',
      aliases: ['zechariah', 'zech', 'zec', 'zc'],
      chapters: [21,13,10,14,11,15,14,23,17,12,17,14,9,21]
    },
    {
      id: 39, code: 'Mal', name: 'Malachi',
      aliases: ['malachi', 'mal', 'ml'],
      chapters: [14,17,18,6]
    },
    {
      id: 40, code: 'Mat', name: 'Matthew',
      aliases: ['matthew', 'matt', 'mat', 'mt'],
      chapters: [25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20]
    },
    {
      id: 41, code: 'Mar', name: 'Mark',
      aliases: ['mark', 'mrk', 'mar', 'mk', 'mr'],
      chapters: [45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20]
    },
    {
      id: 42, code: 'Luk', name: 'Luke',
      aliases: ['luke', 'luk', 'lk'],
      chapters: [80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53]
    },
    {
      id: 43, code: 'Jhn', name: 'John',
      aliases: ['john', 'jhn', 'jn'],
      chapters: [51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25]
    },
    {
      id: 44, code: 'Act', name: 'Acts',
      aliases: ['acts of the apostles', 'acts', 'act', 'ac'],
      chapters: [26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31]
    },
    {
      id: 45, code: 'Rom', name: 'Romans',
      aliases: ['romans', 'rom', 'ro', 'rm'],
      chapters: [32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27]
    },
    {
      id: 46, code: '1Co', name: '1 Corinthians',
      aliases: ['1 corinthians', '1 cor', '1 co', '1corinthians', '1cor', '1co', '1st corinthians', 'first corinthians', 'i corinthians', 'i cor', 'i co'],
      chapters: [31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24]
    },
    {
      id: 47, code: '2Co', name: '2 Corinthians',
      aliases: ['2 corinthians', '2 cor', '2 co', '2corinthians', '2cor', '2co', '2nd corinthians', 'second corinthians', 'ii corinthians', 'ii cor', 'ii co'],
      chapters: [24,17,18,18,21,18,16,24,15,18,33,21,14]
    },
    {
      id: 48, code: 'Gal', name: 'Galatians',
      aliases: ['galatians', 'gal', 'ga'],
      chapters: [24,21,29,31,26,18]
    },
    {
      id: 49, code: 'Eph', name: 'Ephesians',
      aliases: ['ephesians', 'eph', 'ep'],
      chapters: [23,22,21,32,33,24]
    },
    {
      id: 50, code: 'Phl', name: 'Philippians',
      aliases: ['philippians', 'phil', 'php', 'phl', 'pp'],
      chapters: [30,30,21,23]
    },
    {
      id: 51, code: 'Col', name: 'Colossians',
      aliases: ['colossians', 'col'],
      chapters: [29,23,25,18]
    },
    {
      id: 52, code: '1Th', name: '1 Thessalonians',
      aliases: ['1 thessalonians', '1 thess', '1 thes', '1 th', '1thessalonians', '1thess', '1thes', '1th', '1st thessalonians', 'first thessalonians', 'i thessalonians', 'i thess', 'i th'],
      chapters: [10,20,13,18,28]
    },
    {
      id: 53, code: '2Th', name: '2 Thessalonians',
      aliases: ['2 thessalonians', '2 thess', '2 thes', '2 th', '2thessalonians', '2thess', '2thes', '2th', '2nd thessalonians', 'second thessalonians', 'ii thessalonians', 'ii thess', 'ii th'],
      chapters: [12,17,18]
    },
    {
      id: 54, code: '1Ti', name: '1 Timothy',
      aliases: ['1 timothy', '1 tim', '1 ti', '1timothy', '1tim', '1ti', '1st timothy', 'first timothy', 'i timothy', 'i tim', 'i ti'],
      chapters: [20,15,16,16,25,21]
    },
    {
      id: 55, code: '2Ti', name: '2 Timothy',
      aliases: ['2 timothy', '2 tim', '2 ti', '2timothy', '2tim', '2ti', '2nd timothy', 'second timothy', 'ii timothy', 'ii tim', 'ii ti'],
      chapters: [18,26,17,22]
    },
    {
      id: 56, code: 'Tit', name: 'Titus',
      aliases: ['titus', 'tit', 'ti'],
      chapters: [16,15,15]
    },
    {
      id: 57, code: 'Phm', name: 'Philemon',
      aliases: ['philemon', 'philem', 'phm', 'pm'],
      chapters: [25]
    },
    {
      id: 58, code: 'Heb', name: 'Hebrews',
      aliases: ['hebrews', 'heb', 'he'],
      chapters: [14,18,19,16,14,20,28,13,28,39,40,29,25]
    },
    {
      id: 59, code: 'Jas', name: 'James',
      aliases: ['james', 'jas', 'jm'],
      chapters: [27,26,18,17,20]
    },
    {
      id: 60, code: '1Pe', name: '1 Peter',
      aliases: ['1 peter', '1 pet', '1 pe', '1 pt', '1peter', '1pet', '1pe', '1pt', '1st peter', 'first peter', 'i peter', 'i pet', 'i pe'],
      chapters: [25,25,22,19,14]
    },
    {
      id: 61, code: '2Pe', name: '2 Peter',
      aliases: ['2 peter', '2 pet', '2 pe', '2 pt', '2peter', '2pet', '2pe', '2pt', '2nd peter', 'second peter', 'ii peter', 'ii pet', 'ii pe'],
      chapters: [21,22,18]
    },
    {
      id: 62, code: '1Jo', name: '1 John',
      aliases: ['1 john', '1 jhn', '1 jn', '1 jo', '1john', '1jhn', '1jn', '1jo', '1st john', 'first john', 'i john', 'i jhn', 'i jn'],
      chapters: [10,29,24,21,21]
    },
    {
      id: 63, code: '2Jo', name: '2 John',
      aliases: ['2 john', '2 jhn', '2 jn', '2 jo', '2john', '2jhn', '2jn', '2jo', '2nd john', 'second john', 'ii john', 'ii jhn', 'ii jn'],
      chapters: [13]
    },
    {
      id: 64, code: '3Jo', name: '3 John',
      aliases: ['3 john', '3 jhn', '3 jn', '3 jo', '3john', '3jhn', '3jn', '3jo', '3rd john', 'third john', 'iii john', 'iii jhn', 'iii jn'],
      chapters: [15]
    },
    {
      id: 65, code: 'Jde', name: 'Jude',
      aliases: ['jude', 'jud', 'jd'],
      chapters: [25]
    },
    {
      id: 66, code: 'Rev', name: 'Revelation',
      aliases: ['revelations', 'revelation', 'rev', 're', 'apocalypse', 'apoc'],
      chapters: [20,29,22,11,14,17,17,13,21,11,19,18,18,20,8,21,18,24,21,15,27,21]
    }
  ];

  const MULTILINGUAL_BOOK_ALIASES = {
    1: ['буття', 'бут', 'бытие', 'быт', 'génesis', 'genesis', '1 mose', '1mose'],
    2: ['вихід', 'вих', 'исход', 'исх', 'éxodo', 'exodo', '2 mose', '2mose'],
    3: ['левит', 'лев', 'левітів', 'левитъ', 'levítico', 'levitico', '3 mose', '3mose'],
    4: ['числа', 'чис', 'números', 'numeros', '4 mose', '4mose'],
    5: ['второзаконня', 'втор', 'второзаконие', 'deuteronomio', '5 mose', '5mose'],
    6: ['ісус навин', 'іс нав', 'иисус навин', 'иис нав', 'josué', 'josue'],
    7: ['суддів', 'суд', 'судей', 'jueces', 'juízes', 'juizes', 'richter'],
    8: ['рут', 'руфь', 'руф', 'rut'],
    9: ['1 царств', '1царств', '1 цар', '1цар', '1 samuel', '1samuel'],
    10: ['2 царств', '2царств', '2 цар', '2цар', '2 samuel', '2samuel'],
    11: ['3 царств', '3царств', '3 цар', '3цар', '1 reyes', '1reyes', '1 reis', '1 könige', '1könige'],
    12: ['4 царств', '4царств', '4 цар', '4цар', '2 reyes', '2reyes', '2 reis', '2 könige', '2könige'],
    13: ['1 хронік', '1хронік', '1 паралипоменон', '1 chronicles', '1 crónicas', '1 cronicas'],
    14: ['2 хронік', '2хронік', '2 паралипоменон', '2 chronicles', '2 crónicas', '2 cronicas'],
    15: ['ездри', 'езд', 'ездра', 'esdras'],
    16: ['неємії', 'неєм', 'неемия', 'нееми', 'nehemías', 'nehemias'],
    17: ['естер', 'ест', 'есфирь', 'есф', 'ester'],
    18: ['йова', 'йов', 'иов'],
    19: ['псалми', 'псалом', 'пс', 'псалтирь', 'salmos', 'salmo', 'sal', 'psalmen'],
    20: ['приповісті', 'прип', 'притчі', 'притчи', 'притч', 'proverbios', 'sprüche'],
    21: ['екклезіяст', 'еккл', 'екклесиаст', 'eclesiastés', 'eclesiastes', 'prediger'],
    22: ['пісня пісень', 'пісн', 'песнь песней', 'песн', 'cantar de los cantares', 'cantares', 'hohelied'],
    23: ['ісаї', 'ісая', 'іс', 'исаия', 'исаии', 'ис', 'isaías', 'isaias', 'jesaja'],
    24: ['єремії', 'єр', 'иеремия', 'иер', 'jeremías', 'jeremias'],
    25: ['плач єремії', 'плач', 'lamentaciones', 'klagelieder'],
    26: ['єзекіїля', 'єз', 'иезекииль', 'иез', 'ezequiel'],
    27: ['даниїла', 'дан', 'даниил', 'daniel'],
    28: ['осії', 'ос', 'осия', 'oseas'],
    29: ['йоіла', 'йоіл', 'иоиль', 'иоил', 'joel'],
    30: ['амоса', 'ам', 'амос', 'amós', 'amos'],
    31: ['овдія', 'овд', 'авдий', 'авд', 'abdías', 'abdias', 'obadja'],
    32: ['йони', 'йон', 'иона', 'jonás', 'jonas'],
    33: ['михея', 'мих', 'miqueas', 'micha'],
    34: ['наума', 'наум', 'nahúm', 'nahum'],
    35: ['авакума', 'авак', 'аввакум', 'авв', 'habacuc'],
    36: ['софонії', 'соф', 'софония', 'sofonías', 'sofonias', 'zefanja'],
    37: ['огія', 'ог', 'аггей', 'агг', 'hageo', 'haggai'],
    38: ['захарії', 'зах', 'захария', 'zacarías', 'zacarias', 'sacharja'],
    39: ['малахії', 'мал', 'малахия', 'malaquías', 'malaquias', 'maleachi'],
    40: ['матвія', 'матв', 'мт', 'матфея', 'матф', 'mateo', 'matthäus', 'matthaus', 'mateus'],
    41: ['марка', 'марк', 'мр', 'мк', 'marcos', 'markus'],
    42: ['луки', 'лук', 'лк', 'lucas', 'lukas'],
    43: ['івана', 'ів', 'иоанна', 'ин', 'juan', 'joão', 'joao', 'johannes'],
    44: ['дії', 'діяння', 'деяния', 'деян', 'hechos', 'hch', 'atos', 'apostelgeschichte'],
    45: ['римлян', 'римлянам', 'рим', 'romanos', 'römer', 'roemer'],
    46: ['1 коринтян', '1 кор', '1кор', '1 коринфянам', '1коринфянам', '1 corintios', '1 coríntios', '1 korinther'],
    47: ['2 коринтян', '2 кор', '2кор', '2 коринфянам', '2коринфянам', '2 corintios', '2 coríntios', '2 korinther'],
    48: ['галатів', 'гал', 'галатам', 'gálatas', 'galatas', 'galater'],
    49: ['ефесян', 'еф', 'ефесянам', 'efesios', 'efésios', 'epheser'],
    50: ['филип\'ян', 'филип’ян', 'фил', 'филиппийцам', 'filipenses', 'philipper'],
    51: ['колосян', 'кол', 'колоссянам', 'colosenses', 'kolosser'],
    52: ['1 солунян', '1 сол', '1 фессалоникийцам', '1 фесс', '1 tesalonicenses', '1 thessalonicher'],
    53: ['2 солунян', '2 сол', '2 фессалоникийцам', '2 фесс', '2 tesalonicenses', '2 thessalonicher'],
    54: ['1 тимофія', '1 тим', '1 тимофею', '1тим', '1 timoteo', '1 timotheus'],
    55: ['2 тимофія', '2 тим', '2 тимофею', '2тим', '2 timoteo', '2 timotheus'],
    56: ['тита', 'тит', 'tito'],
    57: ['филимона', 'флм', 'филимону', 'filemón', 'filemon'],
    58: ['євреїв', 'євр', 'евреям', 'евр', 'hebreos', 'hebräer', 'hebraer'],
    59: ['якова', 'як', 'иакова', 'иак', 'santiago', 'tiago', 'jakobus'],
    60: ['1 петра', '1 пет', '1пет', '1 pedro', '1 petrus'],
    61: ['2 петра', '2 пет', '2пет', '2 pedro', '2 petrus'],
    62: ['1 івана', '1 ів', '1 иоанна', '1 ин', '1 ін', '1 juan', '1 joão', '1 johannes'],
    63: ['2 івана', '2 ів', '2 иоанна', '2 ин', '2 juan', '2 joão', '2 johannes'],
    64: ['3 івана', '3 ів', '3 иоанна', '3 ин', '3 juan', '3 joão', '3 johannes'],
    65: ['юди', 'юд', 'иуды', 'иуд', 'judas'],
    66: ['об\'явлення', 'об’явлення', 'об', 'откровение', 'откр', 'apocalipsis', 'apocalipse', 'offenbarung']
  };

  for (const [idStr, aliases] of Object.entries(MULTILINGUAL_BOOK_ALIASES)) {
    const book = BOOKS.find(b => b.id === Number(idStr));
    if (book) {
      for (const a of aliases) {
        if (!book.aliases.includes(a)) {
          book.aliases.push(a);
        }
      }
    }
  }

  // Single-chapter books (Obadiah, Philemon, 2 John, 3 John, Jude)
  const SINGLE_CHAPTER_BOOKS = new Set([31, 57, 63, 64, 65]);

  // Ambiguous short aliases that should ONLY match if followed by chapter:verse (not bare chapter)
  const AMBIGUOUS_CHAPTER_ONLY_ALIASES = new Set([
    'is', 'am', 'he', 'ne', 'es', 'la', 'na', 'ro', 'ti', 're', 'ac', 'ga', 'ep', 'ho', 'da', 'le', 'nu', 'ru', 'ez'
  ]);

  const TRANSLATIONS = {
    BSB: {
      id: 'BSB',
      name: 'Berean Standard Bible',
      shortName: 'BSB',
      bundled: true,
      downloadable: false,
      copyright: 'Public Domain (Berean.Bible)'
    },
    KJV: {
      id: 'KJV',
      name: 'King James Version',
      shortName: 'KJV',
      bundled: false,
      downloadable: true,
      bollsCode: 'KJV',
      bpCode: 'KJV',
      copyright: 'Public Domain'
    },
    ESV: {
      id: 'ESV',
      name: 'English Standard Version',
      shortName: 'ESV',
      bundled: false,
      downloadable: true,
      bollsCode: 'ESV',
      bpCode: 'ESV',
      copyright: 'Crossway'
    },
    NIV: {
      id: 'NIV',
      name: 'New International Version',
      shortName: 'NIV',
      bundled: false,
      downloadable: false,
      bpCode: 'NIV',
      copyright: 'Biblica'
    },
    NLT: {
      id: 'NLT',
      name: 'New Living Translation',
      shortName: 'NLT',
      bundled: false,
      downloadable: true,
      bollsCode: 'NLT',
      bpCode: 'NLT',
      copyright: 'Tyndale House'
    },
    NASB: {
      id: 'NASB',
      name: 'New American Standard Bible',
      shortName: 'NASB',
      bundled: false,
      downloadable: true,
      bollsCode: 'NASB',
      bpCode: 'NASB95',
      copyright: 'Lockman Foundation'
    },
    CSB: {
      id: 'CSB',
      name: 'Christian Standard Bible',
      shortName: 'CSB',
      bundled: false,
      downloadable: true,
      bollsCode: 'CSB17',
      bpCode: 'CSB',
      copyright: 'Holman Bible Publishers'
    },
    NKJV: {
      id: 'NKJV',
      name: 'New King James Version',
      shortName: 'NKJV',
      bundled: false,
      downloadable: true,
      bollsCode: 'NKJV',
      bpCode: 'NKJV',
      copyright: 'Thomas Nelson'
    },
    WEB: {
      id: 'WEB',
      name: 'World English Bible',
      shortName: 'WEB',
      bundled: false,
      downloadable: true,
      bollsCode: 'WEB',
      bpCode: 'WEB',
      copyright: 'Public Domain'
    },
    // Ukrainian
    TUR: {
      id: 'TUR',
      name: 'Українська (Р. Турконяка)',
      shortName: 'TUR',
      language: 'Ukrainian',
      flag: '🇺🇦',
      bundled: false,
      downloadable: true,
      bollsCode: 'UTT',
      copyright: 'Українське Біблійне Товариство (2011)'
    },
    UBIO: {
      id: 'UBIO',
      name: 'Українська (Іван Огієнко)',
      shortName: 'UBIO',
      language: 'Ukrainian',
      flag: '🇺🇦',
      bundled: false,
      downloadable: true,
      bollsCode: 'UBIO',
      copyright: 'Public Domain (1962)'
    },
    // Spanish
    LBLA: {
      id: 'LBLA',
      name: 'La Biblia de las Américas',
      shortName: 'LBLA',
      language: 'Spanish',
      flag: '🇪🇸',
      bundled: false,
      downloadable: true,
      bollsCode: 'LBLA',
      copyright: 'The Lockman Foundation (1997)'
    },
    RV1960: {
      id: 'RV1960',
      name: 'Reina-Valera 1960',
      shortName: 'RV1960',
      language: 'Spanish',
      flag: '🇪🇸',
      bundled: false,
      downloadable: true,
      bollsCode: 'RV1960',
      copyright: 'Sociedades Bíblicas Unidas'
    },
    // Portuguese
    NAA: {
      id: 'NAA',
      name: 'Nova Almeida Atualizada',
      shortName: 'NAA',
      language: 'Portuguese',
      flag: '🇵🇹',
      bundled: false,
      downloadable: true,
      bollsCode: 'NAA',
      copyright: 'Sociedade Bíblica do Brasil (2017)'
    },
    ARA: {
      id: 'ARA',
      name: 'Almeida Revista e Atualizada',
      shortName: 'ARA',
      language: 'Portuguese',
      flag: '🇧🇷',
      bundled: false,
      downloadable: true,
      bollsCode: 'ARA',
      copyright: 'Sociedade Bíblica do Brasil (1993)'
    },
    // German
    SCH2000: {
      id: 'SCH2000',
      name: 'Schlachter 2000',
      shortName: 'SCH2000',
      language: 'German',
      flag: '🇩🇪',
      bundled: false,
      downloadable: true,
      bollsCode: 'S00',
      copyright: 'Genfer Bibelgesellschaft (2000)'
    },
    // Chinese
    CUNPS: {
      id: 'CUNPS',
      name: '和合本 (简体 - CUV)',
      shortName: 'CUNPS',
      language: 'Chinese',
      flag: '🇨🇳',
      bundled: false,
      downloadable: true,
      bollsCode: 'CUNPS',
      copyright: 'Public Domain / HKBS'
    },
    CUNP: {
      id: 'CUNP',
      name: '和合本 (繁體 - CUV)',
      shortName: 'CUNP',
      language: 'Chinese',
      flag: '🇨🇳',
      bundled: false,
      downloadable: true,
      bollsCode: 'CUNP',
      copyright: 'Public Domain / HKBS'
    },
    // Korean
    KRV: {
      id: 'KRV',
      name: '개역한글 (KRV)',
      shortName: 'KRV',
      language: 'Korean',
      flag: '🇰🇷',
      bundled: false,
      downloadable: true,
      bollsCode: 'KRV',
      copyright: 'Korean Bible Society'
    },
    // Hindi
    HIOV: {
      id: 'HIOV',
      name: 'हिंदी O.V. (BSI)',
      shortName: 'HIOV',
      language: 'Hindi',
      flag: '🇮🇳',
      bundled: false,
      downloadable: true,
      bollsCode: 'HIOV',
      copyright: 'Bible Society of India'
    },
    // Russian
    SYNOD: {
      id: 'SYNOD',
      name: 'Синодальный перевод (1876)',
      shortName: 'SYNOD',
      language: 'Russian',
      flag: '🇷🇺',
      bundled: false,
      downloadable: true,
      bollsCode: 'SYNOD',
      copyright: 'Public Domain'
    },
    NRT: {
      id: 'NRT',
      name: 'Новый русский перевод (НРП)',
      shortName: 'NRT',
      language: 'Russian',
      flag: '🇷🇺',
      bundled: false,
      downloadable: true,
      bollsCode: 'NRT',
      copyright: 'Biblica'
    }
  };

  const TRANSLATION_ALIASES = {
    'BSB': 'BSB',
    'KJV': 'KJV',
    'NKJV': 'NKJV',
    'ESV': 'ESV',
    'NIV': 'NIV',
    'NIV84': 'NIV',
    'NIV11': 'NIV',
    'NLT': 'NLT',
    'NASB': 'NASB',
    'NASB95': 'NASB',
    'NASB20': 'NASB',
    'CSB': 'CSB',
    'HCSB': 'CSB',
    'WEB': 'WEB',
    // Ukrainian
    'TUR': 'TUR',
    'UTT': 'TUR',
    'ТУРКОНЯКА': 'TUR',
    'ТУРК': 'TUR',
    'UBIO': 'UBIO',
    'ОГІЄНКО': 'UBIO',
    'ОГИЕНКО': 'UBIO',
    // Spanish
    'LBLA': 'LBLA',
    'NBLA': 'LBLA',
    'RV1960': 'RV1960',
    'RVR60': 'RV1960',
    'RVR1960': 'RV1960',
    'RV60': 'RV1960',
    // Portuguese
    'NAA': 'NAA',
    'ARA': 'ARA',
    // German
    'SCH2000': 'SCH2000',
    'S00': 'SCH2000',
    'SCH': 'SCH2000',
    // Chinese
    'CUNPS': 'CUNPS',
    'CUNP': 'CUNP',
    'CUV': 'CUNPS',
    // Korean
    'KRV': 'KRV',
    // Hindi
    'HIOV': 'HIOV',
    'HIN': 'HIOV',
    // Russian
    'SYNOD': 'SYNOD',
    'СИНОД': 'SYNOD',
    'RST': 'SYNOD',
    'NRT': 'NRT',
    'НРП': 'NRT'
  };

  // Lookup maps
  const BOOK_BY_ID = new Map();
  const BOOK_BY_CODE = new Map();
  const BOOK_BY_ALIAS = new Map();

  for (const book of BOOKS) {
    BOOK_BY_ID.set(book.id, book);
    BOOK_BY_CODE.set(book.code.toLowerCase(), book);
    BOOK_BY_ALIAS.set(book.name.toLowerCase(), book);
    for (const alias of book.aliases) {
      BOOK_BY_ALIAS.set(alias.toLowerCase(), book);
    }
  }

  function normalizeBookKey(raw) {
    return raw
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function resolveBook(rawBookStr) {
    if (!rawBookStr) return null;
    const key = normalizeBookKey(rawBookStr);
    if (BOOK_BY_ALIAS.has(key)) return BOOK_BY_ALIAS.get(key);
    // Try collapsing space after leading number (e.g., "1  cor" -> "1 cor")
    const compact = key.replace(/^([123i]+)\s+/, '$1 ');
    return BOOK_BY_ALIAS.get(compact) || null;
  }

  // Sort all aliases longest-first to build regex alternation so "1 John" matches before "John", "Song of Solomon" before "Song", etc.
  const allAliasesSorted = Array.from(BOOK_BY_ALIAS.keys()).sort((a, b) => b.length - a.length);
  const escapedAliases = allAliasesSorted.map(a =>
    a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
  );

  const translationKeys = Object.keys(TRANSLATION_ALIASES).join('|');

  // Master regex to detect primary Scripture references in text
  // Groups:
  // 1: Book name/abbreviation (with optional trailing period)
  // 2: Chapter + Verse/Range specification (e.g. "3:16-18", "1:26-2:3", "23")
  // 3: Optional trailing translation tag, e.g. "(ESV)" or "NIV" or "[KJV]"
  const MASTER_REF_REGEX = new RegExp(
    `(?<![\\p{L}\\p{N}_])((?:${escapedAliases.join('|')})\\.?)(?:\\s+)(\\d{1,3}(?:\\s*[:.]\\s*\\d{1,3}[a-z]?(?:\\s*(?:[-–—]\\s*\\d{1,3}[a-z]?(?:\\s*[:.]\\s*\\d{1,3}[a-z]?)?|ff\\b))?(?:\\s*,\\s*\\d{1,3}[a-z]?(?:\\s*[:.]\\s*\\d{1,3}[a-z]?)?(?:\\s*[-–—]\\s*\\d{1,3}[a-z]?(?:\\s*[:.]\\s*\\d{1,3}[a-z]?)?)?)*|\\s*[-–—]\\s*\\d{1,3}[a-z]?)?)(?:\\s*(?:\\(\\s*(${translationKeys})\\s*\\)|\\[\\s*(${translationKeys})\\s*\\]|\\b(${translationKeys})\\b))?(?![\\p{L}\\p{N}])`,
    'giu'
  );

  // Chained continuation regex right after a matched reference: e.g. "; 14:6" or ", 18-20"
  const CHAIN_CONTINUATION_REGEX = new RegExp(
    `^(\\s*([,;])\\s*(?:(?:and|or|&|cf\\.?|v\\.?|vv\\.?)\\s+)?)(\\d{1,3}[a-z]?(?:\\s*[:.]\\s*\\d{1,3}[a-z]?)?(?:\\s*[-–—]\\s*\\d{1,3}[a-z]?(?:\\s*[:.]\\s*\\d{1,3}[a-z]?)?)?)(?:\\s*(?:\\(\\s*(${translationKeys})\\s*\\)|\\[\\s*(${translationKeys})\\s*\\]|\\b(${translationKeys})\\b))?(?![\\p{L}\\p{N}])`,
    'iu'
  );

  /**
   * Parses and validates a book + chapter/verse spec string into structured segments.
   * Returns null if invalid (e.g. chapter > max chapters or verse > max verses in chapter).
   */
  function parseAndValidateSpec(book, rawAliasUsed, specStr, explicitTranslation) {
    if (!book || !specStr) return null;

    const cleanAlias = normalizeBookKey(rawAliasUsed);
    const hasExplicitPeriod = rawAliasUsed.trim().endsWith('.');
    const cleanedSpec = specStr.replace(/[a-z]+$/i, '').trim();

    // Split comma-separated segments within the same reference if any: e.g. "3:16-18, 20"
    const subParts = cleanedSpec.split(/\s*,\s*/);
    const segments = [];
    let currentChapter = null;

    for (let i = 0; i < subParts.length; i++) {
      const part = subParts[i].trim();
      if (!part) continue;

      // Case A: Cross-chapter range "1:26-2:3"
      const crossMatch = part.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})[a-z]?\s*[-–—]\s*(\d{1,3})\s*[:.]\s*(\d{1,3})[a-z]?$/i);
      if (crossMatch) {
        const c1 = parseInt(crossMatch[1], 10);
        const v1 = parseInt(crossMatch[2], 10);
        const c2 = parseInt(crossMatch[3], 10);
        const v2 = parseInt(crossMatch[4], 10);
        if (c1 < 1 || c1 > book.chapters.length || c2 < c1 || c2 > book.chapters.length) return null;
        if (v1 < 1 || v1 > book.chapters[c1 - 1] || v2 < 1 || v2 > book.chapters[c2 - 1]) return null;

        for (let ch = c1; ch <= c2; ch++) {
          const startV = ch === c1 ? v1 : 1;
          const endV = ch === c2 ? v2 : book.chapters[ch - 1];
          segments.push({ chapter: ch, verseStart: startV, verseEnd: endV, isWholeChapter: false });
        }
        currentChapter = c2;
        continue;
      }

      // Case B: Standard Chapter:Verse or Chapter:Verse-Verse "3:16" or "3:16-18"
      const cvMatch = part.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})[a-z]?(?:\s*[-–—]\s*(\d{1,3})[a-z]?)?$/i);
      if (cvMatch) {
        const ch = parseInt(cvMatch[1], 10);
        const v1 = parseInt(cvMatch[2], 10);
        const v2 = cvMatch[3] ? parseInt(cvMatch[3], 10) : v1;
        if (ch < 1 || ch > book.chapters.length) return null;
        const maxV = book.chapters[ch - 1];
        if (v1 < 1 || v1 > maxV || v2 < v1 || v2 > maxV) return null;
        segments.push({ chapter: ch, verseStart: v1, verseEnd: v2, isWholeChapter: false });
        currentChapter = ch;
        continue;
      }

      // Case C: Bare number or number range ("23" or "3-4" or ", 18")
      const bareMatch = part.match(/^(\d{1,3})[a-z]?(?:\s*[-–—]\s*(\d{1,3})[a-z]?)?$/i);
      if (bareMatch) {
        const n1 = parseInt(bareMatch[1], 10);
        const n2 = bareMatch[2] ? parseInt(bareMatch[2], 10) : n1;

        if (currentChapter !== null) {
          // Continuation of verses in currentChapter (e.g., "John 3:16, 18-20")
          const maxV = book.chapters[currentChapter - 1];
          if (n1 < 1 || n1 > maxV || n2 < n1 || n2 > maxV) return null;
          segments.push({ chapter: currentChapter, verseStart: n1, verseEnd: n2, isWholeChapter: false });
        } else if (SINGLE_CHAPTER_BOOKS.has(book.id)) {
          // Single-chapter book like "Jude 3-4" or "Philemon 6" -> Chapter 1, Verse n1..n2
          const maxV = book.chapters[0];
          if (n1 < 1 || n1 > maxV || n2 < n1 || n2 > maxV) return null;
          segments.push({ chapter: 1, verseStart: n1, verseEnd: n2, isWholeChapter: false });
          currentChapter = 1;
        } else {
          // Whole chapter reference like "Psalm 23" or "Romans 8"
          // Guard against ambiguous 2-letter aliases without period (like "is 3" or "am 9")
          if (AMBIGUOUS_CHAPTER_ONLY_ALIASES.has(cleanAlias) && !hasExplicitPeriod) {
            return null;
          }
          // Only allow single whole chapter (or avoid tagging "John 1-3" as chapters unless valid)
          if (bareMatch[2]) return null;
          if (n1 < 1 || n1 > book.chapters.length) return null;
          const maxV = book.chapters[n1 - 1];
          segments.push({ chapter: n1, verseStart: 1, verseEnd: maxV, isWholeChapter: true });
          currentChapter = n1;
        }
        continue;
      }

      return null;
    }

    if (segments.length === 0) return null;

    const normTranslation = explicitTranslation
      ? (TRANSLATION_ALIASES[explicitTranslation.toUpperCase()] || null)
      : null;

    return {
      bookId: book.id,
      bookCode: book.code,
      bookName: book.name,
      segments,
      translation: normTranslation,
      canonicalLabel: formatCanonicalLabel(book, segments)
    };
  }

  function formatCanonicalLabel(book, segments) {
    if (!segments || segments.length === 0) return book.name;
    if (segments.length === 1 && segments[0].isWholeChapter) {
      return `${book.name} ${segments[0].chapter}`;
    }
    if (SINGLE_CHAPTER_BOOKS.has(book.id) && segments.length === 1) {
      const s = segments[0];
      return s.verseStart === s.verseEnd
        ? `${book.name} ${s.verseStart}`
        : `${book.name} ${s.verseStart}–${s.verseEnd}`;
    }
    // Check if cross-chapter contiguous range
    if (
      segments.length > 1 &&
      segments.every((s, idx) => idx === 0 || s.chapter === segments[idx - 1].chapter + 1)
    ) {
      const first = segments[0];
      const last = segments[segments.length - 1];
      return `${book.name} ${first.chapter}:${first.verseStart}–${last.chapter}:${last.verseEnd}`;
    }

    // Group by chapter
    const parts = [];
    let lastCh = null;
    for (const s of segments) {
      const vRange = s.verseStart === s.verseEnd ? `${s.verseStart}` : `${s.verseStart}–${s.verseEnd}`;
      if (s.chapter === lastCh) {
        parts[parts.length - 1] += `, ${vRange}`;
      } else {
        parts.push(`${s.chapter}:${vRange}`);
        lastCh = s.chapter;
      }
    }
    return `${book.name} ${parts.join('; ')}`;
  }

  /**
   * Scans a plain text string and returns an array of validated reference matches:
   * [{ startIndex, endIndex, matchText, parsed }]
   */
  function findReferencesInText(text) {
    if (!text || text.length < 4 || !/\d/.test(text)) return [];

    const results = [];
    MASTER_REF_REGEX.lastIndex = 0;
    let match;

    while ((match = MASTER_REF_REGEX.exec(text)) !== null) {
      const fullMatch = match[0];
      const rawBook = match[1];
      const rawSpec = match[2];
      const rawTrans = match[3] || match[4] || match[5] || null;
      const startIndex = match.index;
      const endIndex = startIndex + fullMatch.length;

      const book = resolveBook(rawBook);
      if (!book) continue;

      const parsed = parseAndValidateSpec(book, rawBook, rawSpec, rawTrans);
      if (!parsed) continue;

      results.push({
        startIndex,
        endIndex,
        matchText: fullMatch,
        parsed
      });

      // Check for chained references immediately following (e.g. "; 14:6" or ", 18")
      let cursor = endIndex;
      let lastSeg = parsed.segments[parsed.segments.length - 1];
      let lastChapter = lastSeg.chapter;
      let lastWasWholeChapter = lastSeg.isWholeChapter;

      while (cursor < text.length) {
        const remaining = text.slice(cursor);
        const chainMatch = CHAIN_CONTINUATION_REGEX.exec(remaining);
        if (!chainMatch) break;

        const prefix = chainMatch[1];
        const delimiter = chainMatch[2]; // ',' or ';'
        const chainSpec = chainMatch[3];
        const chainTrans = chainMatch[4] || chainMatch[5] || chainMatch[6] || parsed.translation;

        // If the text immediately after the prefix starts a brand new Book reference (e.g. ", 1 Cor 13:4"),
        // break out of chaining so MASTER_REF_REGEX matches the new book!
        const afterPrefix = remaining.slice(prefix.length);
        const probeBookRegex = new RegExp(MASTER_REF_REGEX.source, 'i');
        const newBookMatch = probeBookRegex.exec(afterPrefix);
        if (newBookMatch && newBookMatch.index === 0) {
          break;
        }

        let effectiveSpec = chainSpec;
        if (!/[:.]/.test(chainSpec)) {
          if (lastWasWholeChapter) {
            // After a whole chapter (e.g. "Psalm 23"), only chain another chapter if separated by ";" or "," and not ambiguous
            effectiveSpec = chainSpec;
          } else {
            effectiveSpec = `${lastChapter}:${chainSpec}`;
          }
        }

        const chainParsed = parseAndValidateSpec(book, book.name, effectiveSpec, chainTrans);
        if (!chainParsed) break;

        const refStart = cursor + prefix.length;
        const refEnd = cursor + chainMatch[0].length;
        const refText = text.slice(refStart, refEnd);

        results.push({
          startIndex: refStart,
          endIndex: refEnd,
          matchText: refText,
          parsed: chainParsed
        });

        const cSeg = chainParsed.segments[chainParsed.segments.length - 1];
        lastChapter = cSeg.chapter;
        lastWasWholeChapter = cSeg.isWholeChapter;
        cursor = refEnd;
        MASTER_REF_REGEX.lastIndex = cursor;
      }
    }

    return results;
  }

  /**
   * Parses a single user-entered reference string (for the popup quick-lookup bar).
   */
  function parseSingleReference(inputStr) {
    if (!inputStr || typeof inputStr !== 'string') return null;
    const matches = findReferencesInText(inputStr.trim());
    return matches.length > 0 ? matches[0].parsed : null;
  }

  const BibleHoverMeta = {
    BOOKS,
    BOOK_BY_ID,
    BOOK_BY_CODE,
    SINGLE_CHAPTER_BOOKS,
    TRANSLATIONS,
    TRANSLATION_ALIASES,
    resolveBook,
    findReferencesInText,
    parseSingleReference,
    formatCanonicalLabel
  };

  root.BibleHoverMeta = BibleHoverMeta;
})(typeof globalThis !== 'undefined' ? globalThis : window);
