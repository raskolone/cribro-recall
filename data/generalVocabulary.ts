export interface GeneralWord {
  id: string;
  english: string;
  polish: string;
  term?: string;
  definition?: string;
}

export interface GeneralVocabSet {
  id: string;
  title: string;
  levelGroup: 'a1_a2' | 'b1_b2' | 'c1_c2';
  levelName: string;
  levelBadge: string;
  description: string;
  words: GeneralWord[];
  isGeneral: boolean;
  itemCount?: number;
}

export const LEVEL_GROUPS = [
  {
    key: 'a1_a2' as const,
    name: 'Fundamenty Codziennej Komunikacji',
    levels: 'A1 - A2',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    description: 'Podstawowe słownictwo i zwroty niezbędne w codziennych sytuacjach, kontaktach i opisach.'
  },
  {
    key: 'b1_b2' as const,
    name: 'Samodzielność i Precyzja',
    levels: 'B1 - B2',
    badgeClass: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    iconColor: 'text-sky-400',
    borderColor: 'border-sky-500/30',
    description: 'Średniozaawansowane słownictwo do swobodnej pracy, podróżowania, relacji i wyrażania opinii.'
  },
  {
    key: 'c1_c2' as const,
    name: 'Nuanse, Styl i Profesjonalna Komunikacja',
    levels: 'C1 - C2',
    badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    iconColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    description: 'Zaawansowany język biznesowy, formalny, dyplomatyczny oraz wyrafinowane środki wyrazu.'
  }
];

export const GENERAL_VOCABULARY_SETS: GeneralVocabSet[] = [
  // ==========================================
  // LEVEL 1: Fundamenty Codziennej Komunikacji (A1 - A2)
  // ==========================================
  {
    id: 'gen-a1-1',
    title: 'Podstawy Codzienne & Powitania',
    levelGroup: 'a1_a2',
    levelName: 'Fundamenty Codziennej Komunikacji',
    levelBadge: 'A1',
    description: 'Zwroty grzecznościowe, powitania i proste reakcje w codziennych sytuacjach.',
    isGeneral: true,
    words: [
      { id: 'gw-1', english: 'Good morning', polish: 'Dzień dobry (rano)' },
      { id: 'gw-2', english: 'Have a nice day', polish: 'Miłego dnia' },
      { id: 'gw-3', english: 'Nice to meet you', polish: 'Miło Cię poznać' },
      { id: 'gw-4', english: 'Excuse me', polish: 'Przepraszam (zwracając uwagę)' },
      { id: 'gw-5', english: 'I am sorry', polish: 'Przepraszam (żałuję / przykro mi)' },
      { id: 'gw-6', english: 'You are welcome', polish: 'Nie ma za co / Proszę bardzo' },
      { id: 'gw-7', english: 'See you later', polish: 'Do zobaczenia później' },
      { id: 'gw-8', english: 'How are you?', polish: 'Jak się masz?' },
      { id: 'gw-9', english: 'I agree', polish: 'Zgadzam się' },
      { id: 'gw-10', english: 'No problem', polish: 'Nie ma problemu' },
      { id: 'gw-11', english: 'Take care', polish: 'Trzymaj się / Uważaj na siebie' },
      { id: 'gw-12', english: 'Of course', polish: 'Oczywiście' }
    ]
  },
  {
    id: 'gen-a1-2',
    title: 'Dom, Rodzina i Otoczenie',
    levelGroup: 'a1_a2',
    levelName: 'Fundamenty Codziennej Komunikacji',
    levelBadge: 'A1-A2',
    description: 'Nazwy pomieszczeń, mebli, członków rodziny i codziennych przedmiotów.',
    isGeneral: true,
    words: [
      { id: 'gw-13', english: 'Living room', polish: 'Salon / Pokój dzienny' },
      { id: 'gw-14', english: 'Kitchen', polish: 'Kuchnia' },
      { id: 'gw-15', english: 'Bedroom', polish: 'Sypialnia' },
      { id: 'gw-16', english: 'Bathroom', polish: 'Łazienka' },
      { id: 'gw-17', english: 'Parents', polish: 'Rodzice' },
      { id: 'gw-18', english: 'Siblings', polish: 'Rodzeństwo' },
      { id: 'gw-19', english: 'Neighbor', polish: 'Sąsiad / Sąsiadka' },
      { id: 'gw-20', english: 'Furniture', polish: 'Mable' },
      { id: 'gw-21', english: 'Comfortable', polish: 'Wygodny' },
      { id: 'gw-22', english: 'Neighborhood', polish: 'Sąsiedztwo / Okolica' },
      { id: 'gw-23', english: 'Balcony', polish: 'Balkon' },
      { id: 'gw-24', english: 'Household', polish: 'Gospodarstwo domowe' }
    ]
  },
  {
    id: 'gen-a2-1',
    title: 'Jedzenie, Zakupy i Restauracja',
    levelGroup: 'a1_a2',
    levelName: 'Fundamenty Codziennej Komunikacji',
    levelBadge: 'A2',
    description: 'Słownictwo do zamawiania posiłków, robienia zakupów i opisów potraw.',
    isGeneral: true,
    words: [
      { id: 'gw-25', english: 'I would like to order', polish: 'Chciałbym/Chciałabym zamówić' },
      { id: 'gw-26', english: 'The bill, please', polish: 'Rachunek proszę' },
      { id: 'gw-27', english: 'Delicious', polish: 'Pyszny' },
      { id: 'gw-28', english: 'Ingredients', polish: 'Składniki' },
      { id: 'gw-29', english: 'Receipt', polish: 'Paragon' },
      { id: 'gw-30', english: 'Special offer', polish: 'Oferta specjalna / Promocja' },
      { id: 'gw-31', english: 'Customer service', polish: 'Obsługa klienta' },
      { id: 'gw-32', english: 'Bakery', polish: 'Piekarnia' },
      { id: 'gw-33', english: 'Fresh fruit', polish: 'Świeże owoce' },
      { id: 'gw-34', english: 'Vegetarian option', polish: 'Opcja wegetariańska' },
      { id: 'gw-35', english: 'Discount', polish: 'Zniżka / Rabat' },
      { id: 'gw-36', english: 'Table for two', polish: 'Stolik dla dwóch osób' }
    ]
  },
  {
    id: 'gen-a2-2',
    title: 'Czas Wolny, Hobby i Podróże',
    levelGroup: 'a1_a2',
    levelName: 'Fundamenty Codziennej Komunikacji',
    levelBadge: 'A2',
    description: 'Opisywanie zainteresowań, spędzania czasu wolnego i planowania podróży.',
    isGeneral: true,
    words: [
      { id: 'gw-37', english: 'Vacation / Holiday', polish: 'Wakacje / Urlop' },
      { id: 'gw-38', english: 'Flight ticket', polish: 'Bilet lotniczy' },
      { id: 'gw-39', english: 'Boarding pass', polish: 'Karta pokładowa' },
      { id: 'gw-40', english: 'Sightseeing', polish: 'Zwiedzanie zabytków' },
      { id: 'gw-41', english: 'Outdoor activities', polish: 'Aktywności na świeżym powietrzu' },
      { id: 'gw-42', english: 'Spare time', polish: 'Czas wolny' },
      { id: 'gw-43', english: 'Guidebook', polish: 'Przewodnik' },
      { id: 'gw-44', english: 'Accommodation', polish: 'Zakwaterowanie / Nocleg' },
      { id: 'gw-45', english: 'Luggage / Baggage', polish: 'Bagaż' },
      { id: 'gw-46', english: 'Explore the city', polish: 'Odkrywać / Zwiedzać miasto' },
      { id: 'gw-47', english: 'Souvenir', polish: 'Pamiątka' },
      { id: 'gw-48', english: 'Relaxation', polish: 'Odpoczynek / Relaks' }
    ]
  },
  {
    id: 'gen-a2-3',
    title: 'Praca, Rutyna i Opis Dnia',
    levelGroup: 'a1_a2',
    levelName: 'Fundamenty Codziennej Komunikacji',
    levelBadge: 'A2',
    description: 'Codzienna rutyna, obowiązki, godziny i podstawowe pojęcia zawodowe.',
    isGeneral: true,
    words: [
      { id: 'gw-49', english: 'Daily routine', polish: 'Codzienna rutyna' },
      { id: 'gw-50', english: 'Schedule', polish: 'Harmonogram / Plan dnia' },
      { id: 'gw-51', english: 'Colleague', polish: 'Kolega / Koleżanka z pracy' },
      { id: 'gw-52', english: 'Appointment', polish: 'Umówione spotkanie / Wizyta' },
      { id: 'gw-53', english: 'Responsibility', polish: 'Obowiązek / Odpowiedzialność' },
      { id: 'gw-54', english: 'Task', polish: 'Zadanie' },
      { id: 'gw-55', english: 'Office hours', polish: 'Godziny pracy biura' },
      { id: 'gw-56', english: 'Take a break', polish: 'Zrobić przerwę' },
      { id: 'gw-57', english: 'Busy day', polish: 'Pracowity / Zajęty dzień' },
      { id: 'gw-58', english: 'Early morning', polish: 'Wczesny poranek' },
      { id: 'gw-59', english: 'Finish work', polish: 'Kończyć pracę' },
      { id: 'gw-60', english: 'Weekly plan', polish: 'Plan tygodniowy' }
    ]
  },

  // ==========================================
  // LEVEL 2: Samodzielność i Precyzja (B1 - B2)
  // ==========================================
  {
    id: 'gen-b1-1',
    title: 'Praca, Biuro i Komunikacja Biznesowa',
    levelGroup: 'b1_b2',
    levelName: 'Samodzielność i Precyzja',
    levelBadge: 'B1',
    description: 'Zwroty z biura, udział w spotkaniach, e-maile służbowe i terminy.',
    isGeneral: true,
    words: [
      { id: 'gw-61', english: 'Deadline', polish: 'Ostateczny termin' },
      { id: 'gw-62', english: 'Feedback', polish: 'Informacja zwrotna' },
      { id: 'gw-63', english: 'Proposal', polish: 'Propozycja / Oferta' },
      { id: 'gw-64', english: 'Agreement', polish: 'Umowa / Porozumienie' },
      { id: 'gw-65', english: 'Strategy', polish: 'Strategia' },
      { id: 'gw-66', english: 'Solution', polish: 'Rozwiązanie' },
      { id: 'gw-67', english: 'Negotiate', polish: 'Negocjować' },
      { id: 'gw-68', english: 'Advantage', polish: 'Zaleta / Przewaga' },
      { id: 'gw-69', english: 'Disadvantage', polish: 'Wada / Niekorzyść' },
      { id: 'gw-70', english: 'Summary', polish: 'Podsumowanie' },
      { id: 'gw-71', english: 'Request', polish: 'Prośba / Wniosek' },
      { id: 'gw-72', english: 'Management', polish: 'Zarządzanie / Dyrekcja' }
    ]
  },
  {
    id: 'gen-b1-2',
    title: 'Technologia, Internet i Nowe Media',
    levelGroup: 'b1_b2',
    levelName: 'Samodzielność i Precyzja',
    levelBadge: 'B1-B2',
    description: 'Aplikacje, cyberbezpieczeństwo, urządzenia, sieci i analiza danych.',
    isGeneral: true,
    words: [
      { id: 'gw-73', english: 'Device', polish: 'Urządzenie' },
      { id: 'gw-74', english: 'Security settings', polish: 'Ustawienia bezpieczeństwa' },
      { id: 'gw-75', english: 'Privacy policy', polish: 'Polityka prywatności' },
      { id: 'gw-76', english: 'Update software', polish: 'Aktualizować oprogramowanie' },
      { id: 'gw-77', english: 'Feature', polish: 'Funkcja / Cecha produktu' },
      { id: 'gw-78', english: 'Database', polish: 'Baza danych' },
      { id: 'gw-79', english: 'Connection', polish: 'Połączenie' },
      { id: 'gw-80', english: 'Notification', polish: 'Powiadomienie' },
      { id: 'gw-81', english: 'User interface', polish: 'Interfejs użytkownika' },
      { id: 'gw-82', english: 'Cloud storage', polish: 'Chmura danych' },
      { id: 'gw-83', english: 'Backup', polish: 'Kopia zapasowa' },
      { id: 'gw-84', english: 'Subscriber', polish: 'Subskrybent' }
    ]
  },
  {
    id: 'gen-b2-1',
    title: 'Emocje, Osobowość i Relacje Międzyludzkie',
    levelGroup: 'b1_b2',
    levelName: 'Samodzielność i Precyzja',
    levelBadge: 'B2',
    description: 'Przymiotniki opisujące charakter, uczucia, postawy i relacje.',
    isGeneral: true,
    words: [
      { id: 'gw-85', english: 'Reliable', polish: 'Niezawodny / Słowny' },
      { id: 'gw-86', english: 'Ambitious', polish: 'Ambitny' },
      { id: 'gw-87', english: 'Stubborn', polish: 'Uparty' },
      { id: 'gw-88', english: 'Sensitive', polish: 'Wrażliwy' },
      { id: 'gw-89', english: 'Empathy', polish: 'Empatia' },
      { id: 'gw-90', english: 'Attitude', polish: 'Postawa / Nastawienie' },
      { id: 'gw-91', english: 'Behavior', polish: 'Zachowanie' },
      { id: 'gw-92', english: 'Influence', polish: 'Wpływ / Wpływać' },
      { id: 'gw-93', english: 'First impression', polish: 'Pierwsze wrażenie' },
      { id: 'gw-94', english: 'Trustworthy', polish: 'Godny zaufania' },
      { id: 'gw-95', english: 'Resolve conflict', polish: 'Rozwiązać konflikt' },
      { id: 'gw-96', english: 'Open-minded', polish: 'Otwarty / Bez uprzedzeń' }
    ]
  },
  {
    id: 'gen-b2-2',
    title: 'Podróże, Lotnisko i Sytuacje Awaryjne',
    levelGroup: 'b1_b2',
    levelName: 'Samodzielność i Precyzja',
    levelBadge: 'B2',
    description: 'Zwroty podczas podróży zagranicznych, odprawy, procedur i awarii.',
    isGeneral: true,
    words: [
      { id: 'gw-97', english: 'Destination', polish: 'Cel podróży' },
      { id: 'gw-98', english: 'Departure', polish: 'Odlot / Odjazd' },
      { id: 'gw-99', english: 'Delayed flight', polish: 'Opóźniony lot' },
      { id: 'gw-100', english: 'Customs clearance', polish: 'Odprawa celna' },
      { id: 'gw-101', english: 'Travel insurance', polish: 'Ubezpieczenie turystyczne' },
      { id: 'gw-102', english: 'Emergency exit', polish: 'Wyjście ewakuacyjne' },
      { id: 'gw-103', english: 'Lost luggage', polish: 'Zagubiony bagaż' },
      { id: 'gw-104', english: 'Cancel reservation', polish: 'Anulować rezerwację' },
      { id: 'gw-105', english: 'Directions', polish: 'Wskazówki dojazdu' },
      { id: 'gw-106', english: 'Vehicle rental', polish: 'Wynajem pojazdu' },
      { id: 'gw-107', english: 'Boarding gate', polish: 'Bramka na lotnisku' },
      { id: 'gw-108', english: 'Currency exchange', polish: 'Kantor / Wymiana walut' }
    ]
  },
  {
    id: 'gen-b2-3',
    title: 'Zdrowie, Styl Życia i Medycyna',
    levelGroup: 'b1_b2',
    levelName: 'Samodzielność i Precyzja',
    levelBadge: 'B2',
    description: 'Słownictwo zdrowotne, medyczne, opis objawów i profilaktyki.',
    isGeneral: true,
    words: [
      { id: 'gw-109', english: 'Symptom', polish: 'Objaw' },
      { id: 'gw-110', english: 'Prescription', polish: 'Recepta' },
      { id: 'gw-111', english: 'Treatment', polish: 'Leczenie / Kuracja' },
      { id: 'gw-112', english: 'Recovery', polish: 'Powrót do zdrowia / Wyzdrowienie' },
      { id: 'gw-113', english: 'Mental health', polish: 'Zdrowie psychiczne' },
      { id: 'gw-114', english: 'Prevention', polish: 'Profilaktyka / Zapobieganie' },
      { id: 'gw-115', english: 'Physical examination', polish: 'Badanie fizykalne' },
      { id: 'gw-116', english: 'Side effect', polish: 'Efekt uboczny' },
      { id: 'gw-117', english: 'Balanced diet', polish: 'Zbalansowana dieta' },
      { id: 'gw-118', english: 'Fatigue', polish: 'Zmęczenie / Znużenie' },
      { id: 'gw-119', english: 'Allergic reaction', polish: 'Reakcja alergiczna' },
      { id: 'gw-120', english: 'Healthcare professional', polish: 'Pracownik ochrony zdrowia' }
    ]
  },

  // ==========================================
  // LEVEL 3: Nuanse, Styl i Profesjonalna Komunikacja (C1 - C2)
  // ==========================================
  {
    id: 'gen-c1-1',
    title: 'Zaawansowany Język Biznesowy i Negocjacje',
    levelGroup: 'c1_c2',
    levelName: 'Nuanse, Styl i Profesjonalna Komunikacja',
    levelBadge: 'C1',
    description: 'Strategie biznesowe, negocjacje, zarządzanie ryzykiem i interesariusze.',
    isGeneral: true,
    words: [
      { id: 'gw-121', english: 'Leverage', polish: 'Dźwignia / Wykorzystać przewagę' },
      { id: 'gw-122', english: 'Consensus', polish: 'Konsensus / Zgoda powszechna' },
      { id: 'gw-123', english: 'Discrepancy', polish: 'Rozbieżność / Niezgodność' },
      { id: 'gw-124', english: 'Contingency plan', polish: 'Plan awaryjny' },
      { id: 'gw-125', english: 'Stakeholder', polish: 'Interesariusz' },
      { id: 'gw-126', english: 'Implement', polish: 'Wdrożyć / Wprowadzić w życie' },
      { id: 'gw-127', english: 'Allocate resources', polish: 'Przydzielić zasoby' },
      { id: 'gw-128', english: 'Bottleneck', polish: 'Wąskie gardło / Przeszkoda' },
      { id: 'gw-129', english: 'Benchmark', polish: 'Wzorzec / Punkt odniesienia' },
      { id: 'gw-130', english: 'Mitigate risk', polish: 'Łagodzić / Minimalizować ryzyko' },
      { id: 'gw-131', english: 'Feasibility study', polish: 'Studium wykonalności' },
      { id: 'gw-132', english: 'Compromise', polish: 'Kompromis' }
    ]
  },
  {
    id: 'gen-c1-2',
    title: 'Abstrakcyjne Pojęcia, Filozofia i Dyskusja',
    levelGroup: 'c1_c2',
    levelName: 'Nuanse, Styl i Profesjonalna Komunikacja',
    levelBadge: 'C1',
    description: 'Zaawansowane pojęcia pojęciowe, wyrażanie zawiłych koncepcji.',
    isGeneral: true,
    words: [
      { id: 'gw-133', english: 'Inevitable', polish: 'Nieunikniony' },
      { id: 'gw-134', english: 'Ambiguous', polish: 'Dwuznaczny / Niejednoznaczny' },
      { id: 'gw-135', english: 'Paradox', polish: 'Paradoks' },
      { id: 'gw-136', english: 'Perception', polish: 'Postrzeganie / Percepcja' },
      { id: 'gw-137', english: 'Comprehensive', polish: 'Wszechstronny / Wyczerpujący' },
      { id: 'gw-138', english: 'Subtle difference', polish: 'Subtelna różnica' },
      { id: 'gw-139', english: 'Profound impact', polish: 'Głęboki / Znaczący wpływ' },
      { id: 'gw-140', english: 'Cognitive bias', polish: 'Błąd poznawczy' },
      { id: 'gw-141', english: 'Phenomenon', polish: 'Zjawisko / Fenomen' },
      { id: 'gw-142', english: 'Advocate for', polish: 'Opowiadać się za / Rzecznik' },
      { id: 'gw-143', english: 'Assertion', polish: 'Twierdzenie / Zapewnienie' },
      { id: 'gw-144', english: 'Hypothesis', polish: 'Hipoteza' }
    ]
  },
  {
    id: 'gen-c1-3',
    title: 'Zaawansowane Zwroty Formalne i Akademickie',
    levelGroup: 'c1_c2',
    levelName: 'Nuanse, Styl i Profesjonalna Komunikacja',
    levelBadge: 'C1-C2',
    description: 'Formalne łączniki wypowiedzi, słownictwo do publikacji i raportów.',
    isGeneral: true,
    words: [
      { id: 'gw-145', english: 'Subsequently', polish: 'Następnie / W konsekwencji' },
      { id: 'gw-146', english: 'Furthermore', polish: 'Ponadto / Co więcej' },
      { id: 'gw-147', english: 'Notwithstanding', polish: 'Niezależnie od / Pomimo' },
      { id: 'gw-148', english: 'Whereas', polish: 'Podczas gdy / Natomiast' },
      { id: 'gw-149', english: 'Conversely', polish: 'Odwrotnie / Z drugiej strony' },
      { id: 'gw-150', english: 'Implicitly', polish: 'Niejawnie / Domyślnie' },
      { id: 'gw-151', english: 'Paramount importance', polish: 'Nadrzędne znaczenie' },
      { id: 'gw-152', english: 'Pivotal role', polish: 'Kluczowa / Przełomowa rola' },
      { id: 'gw-153', english: 'Prerequisite', polish: 'Warunek wstępny' },
      { id: 'gw-154', english: 'Under close scrutiny', polish: 'Pod ścisłą obserwacją / Analizą' },
      { id: 'gw-155', english: 'Substantiate claims', polish: 'Poprzeć twierdzenia dowodami' },
      { id: 'gw-156', english: 'Hitherto', polish: 'Dotychczas' }
    ]
  },
  {
    id: 'gen-c2-1',
    title: 'Psychologia, Zachowania i Przywództwo',
    levelGroup: 'c1_c2',
    levelName: 'Nuanse, Styl i Profesjonalna Komunikacja',
    levelBadge: 'C2',
    description: 'Słownictwo z zakresu inteligencji emocjonalnej, przywództwa i psychologii.',
    isGeneral: true,
    words: [
      { id: 'gw-157', english: 'Resilience', polish: 'Odporność psychiczna / Elastyczność' },
      { id: 'gw-158', english: 'Intrinsic motivation', polish: 'Motywacja wewnętrzna' },
      { id: 'gw-159', english: 'Charismatic leadership', polish: 'Charyzmatyczne przywództwo' },
      { id: 'gw-160', english: 'Delegation of authority', polish: 'Przekazanie uprawnień' },
      { id: 'gw-161', english: 'Emotional intelligence', polish: 'Inteligencja emocjonalna' },
      { id: 'gw-162', english: 'Build rapport', polish: 'Budować dobre relacje / Porozumienie' },
      { id: 'gw-163', english: 'Vulnerability', polish: 'Wrażliwość / Podatność' },
      { id: 'gw-164', english: 'Accountability', polish: 'Pociągalność do odpowiedzialności' },
      { id: 'gw-165', english: 'Perseverance', polish: 'Wytrwałość' },
      { id: 'gw-166', english: 'Cognitive dissonance', polish: 'Dysonans poznawczy' },
      { id: 'gw-167', english: 'Empowerment', polish: 'Uprawomocnienie / Umocnienie' },
      { id: 'gw-168', english: 'Systemic change', polish: 'Zmiana systemowa' }
    ]
  },
  {
    id: 'gen-c2-2',
    title: 'Subtelne Nuanse, Stylistyka i Wyrafinowane Przymiotniki',
    levelGroup: 'c1_c2',
    levelName: 'Nuanse, Styl i Profesjonalna Komunikacja',
    levelBadge: 'C2',
    description: 'Wyrafinowane przymiotniki i przysłówki do eleganckich wypowiedzi i tekstów.',
    isGeneral: true,
    words: [
      { id: 'gw-169', english: 'Meticulous', polish: 'Drobiazgowy / Skrupulatny' },
      { id: 'gw-170', english: 'Eloquent', polish: 'Błyskotliwy / Retorycznie wyrafinowany' },
      { id: 'gw-171', english: 'Ubiquitous', polish: 'Wszechobecny' },
      { id: 'gw-172', english: 'Ephemeral', polish: 'Ulotny / Długotrwały tylko przez chwilę' },
      { id: 'gw-173', english: 'Pragmatic approach', polish: 'Praktyczne / Pragmatyczne podejście' },
      { id: 'gw-174', english: 'Versatile', polish: 'Wszechstronny / Wielofunkcyjny' },
      { id: 'gw-175', english: 'Indispensable', polish: 'Niezastąpiony / Niezbędny' },
      { id: 'gw-176', english: 'Authentic', polish: 'Autentyczny / Prawdziwy' },
      { id: 'gw-177', english: 'Exemplary performance', polish: 'Wzorcowe wykonanie' },
      { id: 'gw-178', english: 'Redundant', polish: 'Zbędny / Zbyteczny' },
      { id: 'gw-179', english: 'Volatile situation', polish: 'Niestabilna / Zmienna sytuacja' },
      { id: 'gw-180', english: 'Unprecedented event', polish: 'Wydarzenie bez precedensu' }
    ]
  }
];
