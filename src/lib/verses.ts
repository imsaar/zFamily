/**
 * Curated set of Quranic verses with Arabic text and English translation.
 * Translations are Saheeh International (widely-used, permissive for redistribution).
 * Deterministic pick by day-of-year so the whole household sees the same
 * verse on the same date.
 *
 * Sources cross-referenced with tanzil.net (Uthmani script) and quran.com.
 */

export type Verse = {
  reference: string;      // "2:255"
  surah: string;          // Al-Baqarah
  arabic: string;
  translation: string;
  theme?: string;
};

export const VERSES: Verse[] = [
  {
    reference: "1:1-3",
    surah: "Al-Fatihah",
    arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝ الرَّحْمَٰنِ الرَّحِيمِ",
    translation:
      "In the name of Allah, the Entirely Merciful, the Especially Merciful. All praise is due to Allah, Lord of the worlds — the Entirely Merciful, the Especially Merciful.",
    theme: "praise",
  },
  {
    reference: "2:152",
    surah: "Al-Baqarah",
    arabic: "فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ",
    translation: "So remember Me; I will remember you. And be grateful to Me and do not deny Me.",
    theme: "gratitude",
  },
  {
    reference: "2:153",
    surah: "Al-Baqarah",
    arabic: "يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
    translation:
      "O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.",
    theme: "patience",
  },
  {
    reference: "2:186",
    surah: "Al-Baqarah",
    arabic:
      "وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ",
    translation:
      "And when My servants ask you concerning Me — indeed I am near. I respond to the invocation of the supplicant when he calls upon Me.",
    theme: "prayer",
  },
  {
    reference: "2:255",
    surah: "Al-Baqarah (Ayat al-Kursi)",
    arabic:
      "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ",
    translation:
      "Allah — there is no deity except Him, the Ever-Living, the Sustainer of existence. Neither drowsiness overtakes Him nor sleep.",
    theme: "tawheed",
  },
  {
    reference: "2:286",
    surah: "Al-Baqarah",
    arabic: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
    translation: "Allah does not charge a soul except with that within its capacity.",
    theme: "ease",
  },
  {
    reference: "3:8",
    surah: "Ali 'Imran",
    arabic:
      "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً ۚ إِنَّكَ أَنْتَ الْوَهَّابُ",
    translation:
      "Our Lord, let not our hearts deviate after You have guided us and grant us from Yourself mercy. Indeed, You are the Bestower.",
    theme: "guidance",
  },
  {
    reference: "3:159",
    surah: "Ali 'Imran",
    arabic: "فَبِمَا رَحْمَةٍ مِنَ اللَّهِ لِنْتَ لَهُمْ ۖ وَلَوْ كُنْتَ فَظًّا غَلِيظَ الْقَلْبِ لَانْفَضُّوا مِنْ حَوْلِكَ",
    translation:
      "So by mercy from Allah, [O Muhammad], you were lenient with them. And if you had been rude [in speech] and harsh in heart, they would have disbanded from about you.",
    theme: "kindness",
  },
  {
    reference: "3:190-191",
    surah: "Ali 'Imran",
    arabic:
      "إِنَّ فِي خَلْقِ السَّمَاوَاتِ وَالْأَرْضِ وَاخْتِلَافِ اللَّيْلِ وَالنَّهَارِ لَآيَاتٍ لِأُولِي الْأَلْبَابِ",
    translation:
      "Indeed, in the creation of the heavens and the earth and the alternation of the night and the day are signs for those of understanding.",
    theme: "reflection",
  },
  {
    reference: "4:36",
    surah: "An-Nisa",
    arabic:
      "وَاعْبُدُوا اللَّهَ وَلَا تُشْرِكُوا بِهِ شَيْئًا ۖ وَبِالْوَالِدَيْنِ إِحْسَانًا",
    translation:
      "Worship Allah and associate nothing with Him, and to parents do good.",
    theme: "family",
  },
  {
    reference: "6:162",
    surah: "Al-An'am",
    arabic: "قُلْ إِنَّ صَلَاتِي وَنُسُكِي وَمَحْيَايَ وَمَمَاتِي لِلَّهِ رَبِّ الْعَالَمِينَ",
    translation:
      "Say, 'Indeed, my prayer, my rites of sacrifice, my living and my dying are for Allah, Lord of the worlds.'",
    theme: "devotion",
  },
  {
    reference: "7:56",
    surah: "Al-A'raf",
    arabic:
      "وَادْعُوهُ خَوْفًا وَطَمَعًا ۚ إِنَّ رَحْمَتَ اللَّهِ قَرِيبٌ مِنَ الْمُحْسِنِينَ",
    translation:
      "And call upon Him in fear and aspiration. Indeed, the mercy of Allah is near to the doers of good.",
    theme: "mercy",
  },
  {
    reference: "8:2",
    surah: "Al-Anfal",
    arabic:
      "إِنَّمَا الْمُؤْمِنُونَ الَّذِينَ إِذَا ذُكِرَ اللَّهُ وَجِلَتْ قُلُوبُهُمْ",
    translation:
      "The believers are only those who, when Allah is mentioned, their hearts become fearful.",
    theme: "faith",
  },
  {
    reference: "9:40",
    surah: "At-Tawbah",
    arabic: "لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا",
    translation: "Do not grieve; indeed Allah is with us.",
    theme: "reassurance",
  },
  {
    reference: "11:88",
    surah: "Hud",
    arabic: "وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ ۚ عَلَيْهِ تَوَكَّلْتُ وَإِلَيْهِ أُنِيبُ",
    translation:
      "And my success is not but through Allah. Upon Him I have relied, and to Him I return.",
    theme: "trust",
  },
  {
    reference: "13:11",
    surah: "Ar-Ra'd",
    arabic: "إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنْفُسِهِمْ",
    translation:
      "Indeed, Allah will not change the condition of a people until they change what is in themselves.",
    theme: "change",
  },
  {
    reference: "13:28",
    surah: "Ar-Ra'd",
    arabic: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
    translation: "Unquestionably, by the remembrance of Allah hearts are assured.",
    theme: "peace",
  },
  {
    reference: "14:7",
    surah: "Ibrahim",
    arabic: "لَئِنْ شَكَرْتُمْ لَأَزِيدَنَّكُمْ",
    translation: "If you are grateful, I will surely increase you [in favor].",
    theme: "gratitude",
  },
  {
    reference: "16:97",
    surah: "An-Nahl",
    arabic:
      "مَنْ عَمِلَ صَالِحًا مِنْ ذَكَرٍ أَوْ أُنْثَىٰ وَهُوَ مُؤْمِنٌ فَلَنُحْيِيَنَّهُ حَيَاةً طَيِّبَةً",
    translation:
      "Whoever does righteousness, whether male or female, while he is a believer — We will surely cause him to live a good life.",
    theme: "righteousness",
  },
  {
    reference: "17:23",
    surah: "Al-Isra",
    arabic:
      "وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا",
    translation:
      "And your Lord has decreed that you not worship except Him, and to parents, good treatment.",
    theme: "family",
  },
  {
    reference: "17:80",
    surah: "Al-Isra",
    arabic:
      "وَقُلْ رَبِّ أَدْخِلْنِي مُدْخَلَ صِدْقٍ وَأَخْرِجْنِي مُخْرَجَ صِدْقٍ",
    translation:
      "And say, 'My Lord, cause me to enter a sound entrance and to exit a sound exit.'",
    theme: "supplication",
  },
  {
    reference: "18:46",
    surah: "Al-Kahf",
    arabic:
      "الْمَالُ وَالْبَنُونَ زِينَةُ الْحَيَاةِ الدُّنْيَا ۖ وَالْبَاقِيَاتُ الصَّالِحَاتُ خَيْرٌ",
    translation:
      "Wealth and children are the adornment of the worldly life, but the enduring good deeds are better.",
    theme: "priorities",
  },
  {
    reference: "20:114",
    surah: "Ta-Ha",
    arabic: "وَقُلْ رَبِّ زِدْنِي عِلْمًا",
    translation: "And say, 'My Lord, increase me in knowledge.'",
    theme: "learning",
  },
  {
    reference: "20:132",
    surah: "Ta-Ha",
    arabic: "وَأْمُرْ أَهْلَكَ بِالصَّلَاةِ وَاصْطَبِرْ عَلَيْهَا",
    translation: "And enjoin prayer upon your family and be steadfast therein.",
    theme: "family",
  },
  {
    reference: "21:87",
    surah: "Al-Anbiya",
    arabic:
      "لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
    translation:
      "There is no deity except You; exalted are You. Indeed, I have been of the wrongdoers.",
    theme: "repentance",
  },
  {
    reference: "24:35",
    surah: "An-Nur",
    arabic: "اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ",
    translation: "Allah is the Light of the heavens and the earth.",
    theme: "light",
  },
  {
    reference: "25:74",
    surah: "Al-Furqan",
    arabic:
      "رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا",
    translation:
      "Our Lord, grant us from among our wives and offspring comfort to our eyes and make us a leader for the righteous.",
    theme: "family",
  },
  {
    reference: "29:69",
    surah: "Al-'Ankabut",
    arabic:
      "وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا",
    translation:
      "And those who strive for Us — We will surely guide them to Our ways.",
    theme: "striving",
  },
  {
    reference: "31:14",
    surah: "Luqman",
    arabic:
      "وَوَصَّيْنَا الْإِنْسَانَ بِوَالِدَيْهِ حَمَلَتْهُ أُمُّهُ وَهْنًا عَلَىٰ وَهْنٍ",
    translation:
      "And We have enjoined upon man [care] for his parents. His mother carried him, [increasing her] in weakness upon weakness.",
    theme: "parents",
  },
  {
    reference: "33:70-71",
    surah: "Al-Ahzab",
    arabic: "يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ وَقُولُوا قَوْلًا سَدِيدًا",
    translation:
      "O you who have believed, fear Allah and speak words of appropriate justice.",
    theme: "speech",
  },
  {
    reference: "39:53",
    surah: "Az-Zumar",
    arabic:
      "لَا تَقْنَطُوا مِنْ رَحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا",
    translation:
      "Do not despair of the mercy of Allah. Indeed, Allah forgives all sins.",
    theme: "hope",
  },
  {
    reference: "40:60",
    surah: "Ghafir",
    arabic: "ادْعُونِي أَسْتَجِبْ لَكُمْ",
    translation: "Call upon Me; I will respond to you.",
    theme: "prayer",
  },
  {
    reference: "41:30",
    surah: "Fussilat",
    arabic:
      "إِنَّ الَّذِينَ قَالُوا رَبُّنَا اللَّهُ ثُمَّ اسْتَقَامُوا تَتَنَزَّلُ عَلَيْهِمُ الْمَلَائِكَةُ",
    translation:
      "Indeed, those who say, 'Our Lord is Allah,' and then remain steadfast — the angels will descend upon them.",
    theme: "steadfastness",
  },
  {
    reference: "42:23",
    surah: "Ash-Shura",
    arabic: "وَمَنْ يَقْتَرِفْ حَسَنَةً نَزِدْ لَهُ فِيهَا حُسْنًا",
    translation:
      "And whoever earns a good deed — We will increase for him good therein.",
    theme: "good deeds",
  },
  {
    reference: "49:13",
    surah: "Al-Hujurat",
    arabic:
      "إِنَّ أَكْرَمَكُمْ عِنْدَ اللَّهِ أَتْقَاكُمْ",
    translation:
      "Indeed, the most noble of you in the sight of Allah is the most righteous of you.",
    theme: "nobility",
  },
  {
    reference: "50:16",
    surah: "Qaf",
    arabic: "وَنَحْنُ أَقْرَبُ إِلَيْهِ مِنْ حَبْلِ الْوَرِيدِ",
    translation: "And We are closer to him than [his] jugular vein.",
    theme: "nearness",
  },
  {
    reference: "51:56",
    surah: "Adh-Dhariyat",
    arabic: "وَمَا خَلَقْتُ الْجِنَّ وَالْإِنْسَ إِلَّا لِيَعْبُدُونِ",
    translation: "I did not create the jinn and mankind except to worship Me.",
    theme: "purpose",
  },
  {
    reference: "55:13",
    surah: "Ar-Rahman",
    arabic: "فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ",
    translation:
      "So which of the favors of your Lord would you deny?",
    theme: "gratitude",
  },
  {
    reference: "57:20",
    surah: "Al-Hadid",
    arabic:
      "اعْلَمُوا أَنَّمَا الْحَيَاةُ الدُّنْيَا لَعِبٌ وَلَهْوٌ وَزِينَةٌ",
    translation:
      "Know that the life of this world is but amusement and diversion and adornment.",
    theme: "perspective",
  },
  {
    reference: "64:11",
    surah: "At-Taghabun",
    arabic: "مَا أَصَابَ مِنْ مُصِيبَةٍ إِلَّا بِإِذْنِ اللَّهِ",
    translation: "No disaster strikes except by permission of Allah.",
    theme: "decree",
  },
  {
    reference: "65:2-3",
    surah: "At-Talaq",
    arabic:
      "وَمَنْ يَتَّقِ اللَّهَ يَجْعَلْ لَهُ مَخْرَجًا ۝ وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ",
    translation:
      "And whoever fears Allah — He will make for him a way out and will provide for him from where he does not expect.",
    theme: "trust",
  },
  {
    reference: "67:2",
    surah: "Al-Mulk",
    arabic:
      "الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا",
    translation:
      "He who created death and life to test you [as to] which of you is best in deed.",
    theme: "purpose",
  },
  {
    reference: "73:8",
    surah: "Al-Muzzammil",
    arabic: "وَاذْكُرِ اسْمَ رَبِّكَ وَتَبَتَّلْ إِلَيْهِ تَبْتِيلًا",
    translation: "And remember the name of your Lord and devote yourself to Him with [complete] devotion.",
    theme: "remembrance",
  },
  {
    reference: "76:9",
    surah: "Al-Insan",
    arabic:
      "إِنَّمَا نُطْعِمُكُمْ لِوَجْهِ اللَّهِ لَا نُرِيدُ مِنْكُمْ جَزَاءً وَلَا شُكُورًا",
    translation:
      "[Saying], 'We feed you only for the countenance of Allah. We wish not from you reward or gratitude.'",
    theme: "sincerity",
  },
  {
    reference: "89:27-28",
    surah: "Al-Fajr",
    arabic:
      "يَا أَيَّتُهَا النَّفْسُ الْمُطْمَئِنَّةُ ۝ ارْجِعِي إِلَىٰ رَبِّكِ رَاضِيَةً مَرْضِيَّةً",
    translation:
      "[To the righteous it will be said], 'O reassured soul, return to your Lord, well-pleased and pleasing [to Him].'",
    theme: "peace",
  },
  {
    reference: "93:5",
    surah: "Ad-Duha",
    arabic: "وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ",
    translation:
      "And your Lord is going to give you, and you will be satisfied.",
    theme: "hope",
  },
  {
    reference: "94:5-6",
    surah: "Ash-Sharh",
    arabic: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation:
      "For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease.",
    theme: "ease",
  },
  {
    reference: "103:1-3",
    surah: "Al-'Asr",
    arabic:
      "وَالْعَصْرِ ۝ إِنَّ الْإِنْسَانَ لَفِي خُسْرٍ ۝ إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ",
    translation:
      "By time, indeed, mankind is in loss, except those who believe and do righteous deeds and advise each other to truth and advise each other to patience.",
    theme: "advice",
  },
  {
    reference: "108:1-3",
    surah: "Al-Kawthar",
    arabic:
      "إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ ۝ فَصَلِّ لِرَبِّكَ وَانْحَرْ ۝ إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ",
    translation:
      "Indeed, We have granted you [O Muhammad], al-Kawthar. So pray to your Lord and sacrifice [to Him alone]. Indeed, your enemy is the one cut off.",
    theme: "gift",
  },
  {
    reference: "112:1-4",
    surah: "Al-Ikhlas",
    arabic:
      "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ",
    translation:
      "Say, 'He is Allah, [who is] One. Allah, the Eternal Refuge. He neither begets nor is born, nor is there to Him any equivalent.'",
    theme: "tawheed",
  },
];

/** Deterministic verse for the given date (same for the whole family, same day). */
export function verseOfDay(date: Date = new Date()): Verse {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return VERSES[dayOfYear % VERSES.length];
}
