import { useMemo, useState } from "react";
import { BookOpen, Brain, ChartNoAxesColumnIncreasing, CheckCircle2, ChevronRight, Clock3, GraduationCap, House, Menu, Search, Settings, Target, X } from "lucide-react";

type Subject = "English" | "Mathematics" | "Biology" | "Chemistry" | "Physics";
type Question = { subject: Subject; topic: string; prompt: string; options: string[]; answer: number; explanation: string };

const questions: Question[] = [
  { subject: "Biology", topic: "Cell biology", prompt: "Which cell structure is mainly responsible for releasing energy during aerobic respiration?", options: ["Ribosome", "Mitochondrion", "Nucleus", "Cell wall"], answer: 1, explanation: "Mitochondria are the main sites of aerobic respiration. They help produce ATP, the cell's usable energy currency." },
  { subject: "Chemistry", topic: "Atomic structure", prompt: "The atomic number of an element is equal to the number of ____ in its nucleus.", options: ["Neutrons", "Electron shells", "Protons", "Isotopes"], answer: 2, explanation: "The atomic number is the number of protons in the nucleus. In a neutral atom, it also equals the number of electrons." },
  { subject: "Physics", topic: "Motion", prompt: "A car travels 120 metres in 10 seconds. What is its average speed?", options: ["10 m/s", "12 m/s", "20 m/s", "1200 m/s"], answer: 1, explanation: "Average speed = distance ÷ time = 120 m ÷ 10 s = 12 m/s." },
  { subject: "Mathematics", topic: "Algebra", prompt: "If 3x + 5 = 20, what is the value of x?", options: ["3", "5", "8", "15"], answer: 1, explanation: "Subtract 5 from both sides: 3x = 15. Divide by 3, so x = 5." },
  { subject: "English", topic: "Grammar", prompt: "Choose the word that correctly completes the sentence: Neither the teacher nor the students ____ late.", options: ["was", "is", "were", "has"], answer: 2, explanation: "With 'neither...nor', the verb generally agrees with the nearer subject. 'Students' is plural, so 'were' is correct." }
];

const subjects: { name: Subject; color: string; detail: string }[] = [
  { name: "English", color: "violet", detail: "Comprehension, grammar and lexis" },
  { name: "Mathematics", color: "blue", detail: "Algebra, geometry and statistics" },
  { name: "Biology", color: "green", detail: "Cells, ecology and genetics" },
  { name: "Chemistry", color: "orange", detail: "Atoms, bonding and reactions" },
  { name: "Physics", color: "pink", detail: "Motion, energy and electricity" }
];

function App() {
  const [page, setPage] = useState<"home" | "practice" | "study">("home");
  const [subject, setSubject] = useState<Subject>("Biology");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");

  const filteredQuestions = useMemo(() => questions.filter(q => q.subject === subject), [subject]);
  const currentQuestion = filteredQuestions[questionIndex % Math.max(filteredQuestions.length, 1)];

  function startPractice(nextSubject: Subject = "Biology") {
    setSubject(nextSubject);
    setQuestionIndex(0);
    setSelected(null);
    setShowAnswer(false);
    setPage("practice");
    setMobileMenu(false);
  }

  function nextQuestion() {
    setQuestionIndex(i => i + 1);
    setSelected(null);
    setShowAnswer(false);
  }

  const nav = [
    { id: "home" as const, label: "Dashboard", icon: House },
    { id: "study" as const, label: "Study notes", icon: BookOpen },
    { id: "practice" as const, label: "CBT practice", icon: Brain }
  ];

  return <div className="app-shell">
    <aside className={mobileMenu ? "sidebar open" : "sidebar"}>
      <div className="brand"><div className="brand-mark"><GraduationCap size={23}/></div><span>Future<span className="brand-accent">Path</span></span><button className="close-menu" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={20}/></button></div>
      <div className="side-label">MENU</div>
      <nav>{nav.map(item => <button key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => { setPage(item.id); setMobileMenu(false); }}><item.icon size={19}/>{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Target size={18}/></div><strong>Small steps. Big goals.</strong><p>Stay consistent and keep moving towards your admission goal.</p></div><button className="nav-item muted"><Settings size={18}/>Settings</button></div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation"/>}
    <main className="main-area">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu/></button><div className="breadcrumb">Your learning space <ChevronRight size={15}/> <strong>{nav.find(n => n.id === page)?.label}</strong></div><div className="top-actions"><div className="avatar">S</div><div className="profile-copy"><strong>Student</strong><span>Keep learning</span></div></div></header>
      <div className="page-content">
        {page === "home" && <>
          <section className="welcome-row"><div><div className="eyebrow">YOUR FUTURE STARTS HERE</div><h1>Welcome to <span>FuturePath.</span></h1><p className="subheading">Build your confidence, one question at a time.</p></div><div className="welcome-art"><div className="art-circle"><GraduationCap size={48}/></div><div className="art-star star-one">✦</div><div className="art-star star-two">✧</div></div></section>
          <section className="hero-card"><div className="hero-content"><div className="hero-tag">YOUR NEXT STEP</div><h2>Ready to prepare<br/>for your big moment?</h2><p>Practise at your pace, understand every topic, and track your progress as you go.</p><button className="primary-button" onClick={() => startPractice()}>Start practising <ChevronRight size={17}/></button></div><div className="hero-graphic"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-book"><BookOpen size={54}/></div><div className="floating-check"><CheckCircle2 size={22}/></div></div></section>
          <div className="section-heading"><div><h2>Explore your subjects</h2><p>Choose a subject and start building your knowledge.</p></div><span className="subject-count">5 SUBJECTS</span></div>
          <section className="subject-grid">{subjects.map(s => <button className="subject-card" key={s.name} onClick={() => startPractice(s.name)}><div className={"subject-icon " + s.color}><BookOpen size={21}/></div><div className="subject-info"><strong>{s.name}</strong><span>{s.detail}</span></div><ChevronRight className="subject-arrow" size={18}/></button>)}</section>
          <section className="bottom-grid"><div className="panel"><div className="panel-title"><div><h3>Make today count</h3><p>A little revision goes a long way.</p></div><div className="panel-symbol"><Clock3 size={20}/></div></div><div className="study-tip"><div className="tip-line"/><div><strong>Try a 20-minute study session</strong><p>Pick one topic, focus on understanding it, then test yourself.</p></div></div><button className="text-button" onClick={() => setPage("study")}>Explore study notes <ChevronRight size={16}/></button></div><div className="panel progress-panel"><div className="panel-title"><div><h3>Your learning journey</h3><p>Your progress will appear here.</p></div><ChartNoAxesColumnIncreasing size={22} className="progress-icon"/></div><div className="empty-progress"><div className="progress-ring"><Target size={25}/></div><span>Ready when you are</span><small>Complete a practice session to get started.</small></div></div></section>
        </>}
        {page === "practice" && <section className="practice-wrap"><button className="back-link" onClick={() => setPage("home")}>← Back to dashboard</button><div className="eyebrow">CBT PRACTICE</div><h1>Test your understanding.</h1><p className="subheading">Choose an answer, check your reasoning, and learn as you go.</p><div className="practice-toolbar"><label htmlFor="subject-select">Subject</label><select id="subject-select" value={subject} onChange={e => startPractice(e.target.value as Subject)}>{subjects.map(s => <option key={s.name}>{s.name}</option>)}</select><span className="question-count">Question {questionIndex + 1}</span></div>{currentQuestion ? <div className="question-card"><div className="question-meta"><span>{currentQuestion.topic}</span><span>Practice question</span></div><h2>{currentQuestion.prompt}</h2><div className="option-list">{currentQuestion.options.map((option, i) => <button key={option} disabled={showAnswer} className={"option " + (selected === i ? "chosen " : "") + (showAnswer && i === currentQuestion.answer ? "correct" : "") + (showAnswer && selected === i && i !== currentQuestion.answer ? "incorrect" : "")} onClick={() => setSelected(i)}><span className="option-letter">{String.fromCharCode(65 + i)}</span>{option}{showAnswer && i === currentQuestion.answer && <CheckCircle2 size={19}/>}</button>)}</div>{showAnswer && <div className="explanation"><strong>{selected === currentQuestion.answer ? "Correct answer!" : "Let's understand this."}</strong><p>{currentQuestion.explanation}</p></div>}<div className="question-actions">{!showAnswer ? <button className="primary-button" disabled={selected === null} onClick={() => setShowAnswer(true)}>Check answer <ChevronRight size={17}/></button> : <button className="primary-button" onClick={nextQuestion}>Next question <ChevronRight size={17}/></button>}</div></div> : <div className="question-card">No practice questions are available for this subject yet.</div>}</section>}
        {page === "study" && <section className="study-wrap"><div className="eyebrow">STUDY CENTRE</div><h1>Learn it. Understand it.</h1><p className="subheading">Short revision notes to help you build strong foundations.</p><div className="search-box"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subjects or topics..."/></div><div className="notes-grid">{[{s:"Biology",t:"Cell structure and functions",d:"Understand the cell as the basic unit of life, including the roles of the nucleus, cytoplasm, cell membrane and mitochondria.",tag:"CELL BIOLOGY"},{s:"Chemistry",t:"Atomic structure",d:"Atoms contain a nucleus of protons and neutrons, with electrons occupying regions around the nucleus. The proton number identifies an element.",tag:"FUNDAMENTALS"},{s:"Physics",t:"Distance, displacement and speed",d:"Distance is the total path travelled. Displacement is the straight-line change in position with direction. Average speed is total distance divided by total time.",tag:"MECHANICS"},{s:"Mathematics",t:"Introduction to algebra",d:"Algebra uses letters to represent numbers. To solve a simple equation, perform the same operation on both sides to keep the equality balanced.",tag:"ALGEBRA"},{s:"English",t:"Parts of speech",d:"Words perform different roles in sentences. Nouns name people or things, verbs express actions or states, and adjectives describe nouns.",tag:"GRAMMAR"}].filter(n => (n.s + n.t).toLowerCase().includes(search.toLowerCase())).map(note => <article className="note-card" key={note.s}><span className="note-tag">{note.tag}</span><h3>{note.t}</h3><p>{note.d}</p><button className="text-button" onClick={() => startPractice(note.s as Subject)}>Practise {note.s} <ChevronRight size={15}/></button></article>)}</div></section>}
        <footer>© 2026 FuturePath <span>Learn with purpose. Prepare with confidence.</span></footer>
      </div>
    </main>
  </div>;
}

export default App;