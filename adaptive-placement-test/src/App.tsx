import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import './App.css'

type DemoQuestion = {
  level: string
  skill: string
  format: string
  prompt: string
  choices: string[]
  signal: string
}

const focusAreas = [
  {
    title: 'Czytanie',
    description:
      'Zaczynamy od bardzo prostych komunikatow, a potem sprawdzamy intencje, szczegoly i tempo rozumienia.',
  },
  {
    title: 'Pisanie',
    description:
      'Od jednowyrazowych odpowiedzi przechodzimy do korekty zdan, parafrazy i krotkich wypowiedzi.',
  },
  {
    title: 'Sluchanie',
    description:
      'Nagrania beda rosly stopniowo: od wyizolowanych fraz po naturalna wymowe i realne tempo.',
  },
  {
    title: 'Adaptacja',
    description:
      'Model oceni pewnosc odpowiedzi i dobierze kolejny krok tak, aby zawezic realny poziom.',
  },
] as const

const buildSteps = [
  {
    step: '01',
    title: 'Szkielet testu',
    description:
      'Widoki startowe, wybor jezyka, przykladowy przeplyw pytan i lokalny zapis postepu.',
    tag: 'robimy teraz',
  },
  {
    step: '02',
    title: 'Silnik adaptacyjny',
    description:
      'Logika trudnosci, ocena odpowiedzi i wybieranie kolejnego pytania na podstawie sygnalow.',
    tag: 'nastepny sprint',
  },
  {
    step: '03',
    title: 'Warstwa AI i raport',
    description:
      'Generowanie tresci, ocena pisania i podsumowanie poziomu z rekomendacjami dalszej nauki.',
    tag: 'po dodaniu API',
  },
] as const

const demoQuestions: DemoQuestion[] = [
  {
    level: 'Pre-A1',
    skill: 'Rozumienie podstawowe',
    format: 'Multiple choice',
    prompt: 'Choose the correct meaning of: "My name is Anna."',
    choices: ['Mam na imie Anna.', 'Anna mieszka tutaj.', 'To jest pokoj Anny.', 'Nie znam Anny.'],
    signal:
      'Poprawna odpowiedz pozwala przejsc do prostych struktur osobowych zamiast zostawac na slowach izolowanych.',
  },
  {
    level: 'A1',
    skill: 'Gramatyka w zdaniu',
    format: 'Fill the gap',
    prompt: 'Complete the sentence: "He ___ from Spain."',
    choices: ['am', 'is', 'are', 'be'],
    signal:
      'Tutaj sprawdzimy, czy uzytkownik rozpoznaje podstawowy zwiazek miedzy osoba a czasownikiem.',
  },
  {
    level: 'A2',
    skill: 'Sluchanie i szczegol',
    format: 'Audio checkpoint',
    prompt: 'A short audio says: "The meeting starts at half past six." What time is the meeting?',
    choices: ['6:15', '6:30', '5:30', '7:00'],
    signal:
      'W kolejnym kroku mozemy zwiekszyc tempo nagrania albo dolozyc szum tla i sprawdzic odpornosc rozumienia.',
  },
  {
    level: 'B1',
    skill: 'Pisanie i ton',
    format: 'Best response',
    prompt: 'Which reply best fits a polite email to a teacher asking for extra time?',
    choices: [
      'Send me the file later.',
      'Can I have a little more time to finish the task, please?',
      'I want more time. Bye.',
      'No problem, you are late.',
    ],
    signal:
      'Dobra odpowiedz sugeruje, ze mozemy przejsc do krotszej produkcji pisemnej ocenianej przez model.',
  },
]

function App() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const cardContentRef = useRef<HTMLDivElement | null>(null)
  const [started, setStarted] = useState(false)
  const [questionIndex, setQuestionIndex] = useState(0)

  useEffect(() => {
    if (!rootRef.current) {
      return
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.topbar',
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
      )

      gsap.fromTo(
        '.hero-copy > *',
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.85, stagger: 0.1, delay: 0.08, ease: 'power3.out' },
      )

      gsap.fromTo(
        '.pillar-card',
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, delay: 0.3, ease: 'power2.out' },
      )

      gsap.fromTo(
        '.demo-card',
        { opacity: 0, y: 40, rotate: 1.8 },
        { opacity: 1, y: 0, rotate: 0, duration: 1, delay: 0.18, ease: 'power4.out' },
      )

      gsap.fromTo(
        '.roadmap-grid > *',
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.82, stagger: 0.12, delay: 0.45, ease: 'power2.out' },
      )
    }, rootRef)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (!cardContentRef.current) {
      return
    }

    gsap.fromTo(
      cardContentRef.current,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' },
    )
  }, [questionIndex, started])

  const handleStart = () => {
    setStarted(true)
    setQuestionIndex(0)
  }

  const handleAdvance = () => {
    setStarted(true)
    setQuestionIndex((currentIndex) => (currentIndex + 1) % demoQuestions.length)
  }

  const handleReset = () => {
    setStarted(false)
    setQuestionIndex(0)
  }

  const activeQuestion = demoQuestions[questionIndex]
  const progress = started ? ((questionIndex + 1) / demoQuestions.length) * 100 : 12

  return (
    <div className="app-shell" ref={rootRef}>
      <main className="frame">
        <header className="topbar">
          <div className="brand">
            <div className="brand__mark">AL</div>
            <div>
              <p className="brand__eyebrow">Nowy projekt od zera</p>
              <p className="brand__name">Adaptive Placement Lab</p>
            </div>
          </div>
          <div className="status-pill">React + TypeScript + GSAP</div>
        </header>

        <section className="hero-grid">
          <div className="hero-copy">
            <p className="hero-copy__eyebrow">Test poziomujacy z mysleniem adaptacyjnym</p>
            <h1 className="hero-title">
              Budujemy aplikacje, ktora startuje od zera i zawedza poziom z kazdym pytaniem.
            </h1>
            <p className="hero-copy__body">
              To jest juz osobny projekt, niezalezny od CRIBRO. Na pierwszym ekranie ustawiamy kierunek:
              czytanie, pisanie i sluchanie beda oceniane etapami, a AI dobierze kolejne pytanie na podstawie
              odpowiedzi i pewnosci modelu.
            </p>

            <div className="cta-row">
              <button className="primary-button" type="button" onClick={handleStart}>
                Pokaz demo pytania
              </button>
              <a className="secondary-button" href="#roadmap">
                Zobacz plan budowy
              </a>
            </div>

            <div className="pillar-grid">
              {focusAreas.map((area, index) => (
                <article className="pillar-card" key={area.title}>
                  <p className="pillar-card__index">0{index + 1}</p>
                  <h2>{area.title}</h2>
                  <p>{area.description}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="demo-card">
            <div className="demo-card__meta">
              <span>Demo adaptacyjne</span>
              <strong>{started ? activeQuestion.level : 'Pre-A1 start'}</strong>
            </div>

            <div className="progress-rail" aria-hidden="true">
              <span style={{ width: `${progress}%` }}></span>
            </div>

            {!started ? (
              <div className="demo-placeholder" ref={cardContentRef}>
                <p className="question-label">Pierwsza iteracja</p>
                <h2>Najpierw uruchamiamy przeplyw, dopiero potem dokladamy prawdziwy silnik oceny.</h2>
                <p>
                  Ta karta pokazuje przykladowe etapy testu: od prostego rozumienia po odpowiedzi wymagajace
                  lepszego tonu i kontroli jezyka.
                </p>
                <button className="primary-button" type="button" onClick={handleStart}>
                  Uruchom pierwsze pytanie
                </button>
              </div>
            ) : (
              <div className="demo-flow" ref={cardContentRef}>
                <p className="question-label">
                  Pytanie demo {questionIndex + 1} z {demoQuestions.length}
                </p>

                <div className="question-kicker">
                  <span>{activeQuestion.skill}</span>
                  <span>{activeQuestion.format}</span>
                </div>

                <h2>{activeQuestion.prompt}</h2>

                <ol className="choice-list">
                  {activeQuestion.choices.map((choice, index) => (
                    <li key={`${activeQuestion.level}-${choice}`}>
                      <button className="choice-pill" type="button">
                        {String.fromCharCode(65 + index)}. {choice}
                      </button>
                    </li>
                  ))}
                </ol>

                <p className="signal-note">
                  <span>AI signal</span>
                  {activeQuestion.signal}
                </p>

                <div className="demo-actions">
                  <button className="primary-button" type="button" onClick={handleAdvance}>
                    Nastepny obszar
                  </button>
                  <button className="ghost-button" type="button" onClick={handleReset}>
                    Reset dema
                  </button>
                </div>
              </div>
            )}
          </aside>
        </section>

        <section className="roadmap-grid" id="roadmap">
          <article className="plan-card">
            <p className="section-label">Plan budowy</p>
            <h2>Rozbijamy projekt na trzy czytelne etapy, zamiast pisac wszystko naraz.</h2>
            <p>
              Dzięki temu w kazdym kroku bedziesz widzial, co dokladnie budujemy, po co to istnieje i jak to
              uruchomic lokalnie bez zgadywania.
            </p>

            <div className="status-grid">
              <div>
                <span>Teraz</span>
                <strong>Osobny projekt i pierwszy ekran</strong>
              </div>
              <div>
                <span>Nastepnie</span>
                <strong>Model danych pytan i wynikow</strong>
              </div>
              <div>
                <span>Potem</span>
                <strong>Integracja AI i ocena odpowiedzi</strong>
              </div>
            </div>
          </article>

          <div className="step-list">
            {buildSteps.map((step) => (
              <article className="step-card" key={step.step}>
                <div className="step-card__number">{step.step}</div>
                <h2>{step.title}</h2>
                <p>{step.description}</p>
                <p className="step-card__tag">{step.tag}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
