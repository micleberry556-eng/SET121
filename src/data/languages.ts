/** All world languages with native names, grouped by region. */
export interface Language {
  code: string;
  name: string;
  native: string;
}

export const languages: Language[] = [
  // Top / most common first
  { code: "en", name: "English", native: "English" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "jv", name: "Javanese", native: "Basa Jawa" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "fr", name: "French", native: "Français" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "my", name: "Burmese", native: "မြန်မာဘာသာ" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "cs", name: "Czech", native: "Čeština" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "hu", name: "Hungarian", native: "Magyar" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "da", name: "Danish", native: "Dansk" },
  { code: "no", name: "Norwegian", native: "Norsk" },
  { code: "he", name: "Hebrew", native: "עברית" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "fa", name: "Persian", native: "فارسی" },
  { code: "sr", name: "Serbian", native: "Српски" },
  { code: "hr", name: "Croatian", native: "Hrvatski" },
  { code: "bg", name: "Bulgarian", native: "Български" },
  { code: "sk", name: "Slovak", native: "Slovenčina" },
  { code: "sl", name: "Slovenian", native: "Slovenščina" },
  { code: "lt", name: "Lithuanian", native: "Lietuvių" },
  { code: "lv", name: "Latvian", native: "Latviešu" },
  { code: "et", name: "Estonian", native: "Eesti" },
  { code: "ka", name: "Georgian", native: "ქართული" },
  { code: "hy", name: "Armenian", native: "Հայերեն" },
  { code: "az", name: "Azerbaijani", native: "Azərbaycan" },
  { code: "kk", name: "Kazakh", native: "Қазақша" },
  { code: "uz", name: "Uzbek", native: "Oʻzbek" },
  { code: "mn", name: "Mongolian", native: "Монгол" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "si", name: "Sinhala", native: "සිංහල" },
  { code: "km", name: "Khmer", native: "ខ្មែរ" },
  { code: "lo", name: "Lao", native: "ລາວ" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "yo", name: "Yoruba", native: "Yorùbá" },
  { code: "ig", name: "Igbo", native: "Igbo" },
  { code: "ha", name: "Hausa", native: "Hausa" },
  { code: "zu", name: "Zulu", native: "isiZulu" },
  { code: "af", name: "Afrikaans", native: "Afrikaans" },
  { code: "tl", name: "Filipino", native: "Filipino" },
  { code: "ca", name: "Catalan", native: "Català" },
  { code: "eu", name: "Basque", native: "Euskara" },
  { code: "gl", name: "Galician", native: "Galego" },
  { code: "is", name: "Icelandic", native: "Íslenska" },
  { code: "ga", name: "Irish", native: "Gaeilge" },
  { code: "cy", name: "Welsh", native: "Cymraeg" },
  { code: "sq", name: "Albanian", native: "Shqip" },
  { code: "mk", name: "Macedonian", native: "Македонски" },
  { code: "bs", name: "Bosnian", native: "Bosanski" },
  { code: "mt", name: "Maltese", native: "Malti" },
  { code: "lb", name: "Luxembourgish", native: "Lëtzebuergesch" },
  { code: "be", name: "Belarusian", native: "Беларуская" },
  { code: "tg", name: "Tajik", native: "Тоҷикӣ" },
  { code: "ky", name: "Kyrgyz", native: "Кыргызча" },
  { code: "tk", name: "Turkmen", native: "Türkmen" },
  { code: "ps", name: "Pashto", native: "پښتو" },
  { code: "ku", name: "Kurdish", native: "Kurdî" },
  { code: "so", name: "Somali", native: "Soomaali" },
  { code: "mg", name: "Malagasy", native: "Malagasy" },
  { code: "rw", name: "Kinyarwanda", native: "Ikinyarwanda" },
  { code: "ht", name: "Haitian Creole", native: "Kreyòl Ayisyen" },
  { code: "mi", name: "Maori", native: "Te Reo Māori" },
  { code: "sm", name: "Samoan", native: "Gagana Samoa" },
  { code: "to", name: "Tongan", native: "Lea Faka-Tonga" },
  { code: "fj", name: "Fijian", native: "Vosa Vakaviti" },
  { code: "haw", name: "Hawaiian", native: "ʻŌlelo Hawaiʻi" },
];

export type PlatformId = "windows" | "linux" | "android" | "ios";

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  icon: string;
  fileName: string;
  fileSize: string;
  description: string;
}

export const platforms: PlatformInfo[] = [
  { id: "windows", name: "Windows", icon: "W", fileName: "Meshlink-Setup.exe", fileSize: "68 MB", description: "Windows 10/11 (64-bit)" },
  { id: "linux", name: "Linux", icon: "L", fileName: "Meshlink.AppImage", fileSize: "72 MB", description: "Ubuntu, Debian, Fedora, Arch" },
  { id: "android", name: "Android", icon: "A", fileName: "Meshlink.apk", fileSize: "45 MB", description: "Android 8.0+" },
  { id: "ios", name: "iOS", icon: "i", fileName: "Meshlink.ipa", fileSize: "52 MB", description: "iOS 15.0+ / iPadOS" },
];
