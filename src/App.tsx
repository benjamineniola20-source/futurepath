import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, BookOpen, Brain, CheckCircle2, ChevronRight, Clock3, GraduationCap, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, Target, Trophy, X } from "lucide-react";
import { supabase } from "./lib/supabase";
import {
  clearActiveExam, getLocalAttempts, getOfflineSnapshot, makeLocalId,
  saveActiveExam, saveOfflineAttempt, syncOfflineContent, syncPendingOfflineAttempts,
  type OfflineAttempt, type OfflineQuestion
} from "./lib/offline";

type Subject={id:string;name:string;slug:string;description:string};
type Note={id:string;subject_id:string;title:string;summary:string;content:string};
type Question=OfflineQuestion;
type Attempt={id:string;client_attempt_id?:string;subject_id:string|null;score_percent:number;correct_answers:number;total_questions:number;started_at:string;mode:string};
type Page="dashboard"|"study"|"quiz"|"past"|"progress"|"admin";
const letter=(i:number)=>String.fromCharCode(65+i);
const score=(n:number)=>Number(n||0).toFixed(1);

export default function App(){
 const [page,setPage]=useState<Page>("dashboard"),[subjects,setSubjects]=useState<Subject[]>([]),[notes,setNotes]=useState<Note[]>([]),[attempts,setAttempts]=useState<Attempt[]>([]);
 const [profile,setProfile]=useState<{full_name:string;role:string}|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [subjectId,setSubjectId]=useState(""),[search,setSearch]=useState(""),[activeNote,setActiveNote]=useState<Note|null>(null),[mobile,setMobile]=useState(false);
 const [questions,setQuestions]=useState<Question[]>([]),[answers,setAnswers]=useState<Record<string,number>>({}),[reviews,setReviews]=useState<Record<string,{correct_option:number;explanation:string}>>({}),[index,setIndex]=useState(0),[started,setStarted]=useState(false),[result,setResult]=useState<{score_percent:number;correct_answers:number;total_questions:number}|null>(null),[busy,setBusy]=useState(false);
 const [year,setYear]=useState("2023"),[pastSubject,setPastSubject]=useState("");
 const [isOnline,setIsOnline]=useState(typeof navigator==="undefined"?true:navigator.onLine),[downloadBusy,setDownloadBusy]=useState(false);
 const [quizMode,setQuizMode]=useState<"quiz"|"mock">("quiz"),[examStartedAt,setExamStartedAt]=useState(0),[secondsLeft,setSecondsLeft]=useState(0);
 const [adminTab,setAdminTab]=useState<"question"|"note">("question");
 const [qForm,setQForm]=useState({subject_id:"",question_text:"",a:"",b:"",c:"",d:"",correct_option:"0",explanation:"",exam_type:"UTME",exam_year:""});
 const [nForm,setNForm]=useState({subject_id:"",title:"",summary:"",content:""});
 async function refresh(){
  setLoading(true);
  try {
   const cached=await getOfflineSnapshot();
   if(cached.subjects.length)setSubjects(cached.subjects);
   if(cached.notes.length)setNotes(cached.notes);
   const local=await getLocalAttempts();
   if(!navigator.onLine||!supabase){
    setAttempts(local.map(a=>({id:a.client_attempt_id,client_attempt_id:a.client_attempt_id,subject_id:a.subject_id,score_percent:a.score_percent,correct_answers:a.correct_answers,total_questions:a.total_questions,started_at:a.started_at,mode:a.mode})));
    setLoading(false);return;
   }
   try {
    const fresh=await syncOfflineContent();
    setSubjects(fresh.subjects);setNotes(fresh.notes);
   } catch (contentError) {
    if(!cached.subjects.length)setError(contentError instanceof Error?contentError.message:"Could not download learning content.");
   }
   await syncPendingOfflineAttempts();
   const [p,a]=await Promise.all([
    supabase.from("profiles").select("full_name,role").maybeSingle(),
    supabase.from("attempts").select("id,client_attempt_id,subject_id,score_percent,correct_answers,total_questions,started_at,mode").order("started_at",{ascending:false}).limit(100)
   ]);
   if(p.data)setProfile(p.data);
   const remote=a.data||[];
   const remoteIds=new Set(remote.map(item=>item.client_attempt_id).filter(Boolean));
   const unsynced=local.filter(item=>!remoteIds.has(item.client_attempt_id)).map(item=>({
    id:item.client_attempt_id,client_attempt_id:item.client_attempt_id,subject_id:item.subject_id,
    score_percent:item.score_percent,correct_answers:item.correct_answers,total_questions:item.total_questions,
    started_at:item.started_at,mode:item.mode
   }));
   setAttempts([...unsynced,...remote]);
  } catch (e) {
   setError(e instanceof Error?e.message:"Could not load saved FuturePath data.");
  } finally {setLoading(false)}
 }
 useEffect(()=>{refresh()},[]);
 useEffect(()=>{
  const online=()=>{setIsOnline(true);syncPendingOfflineAttempts().then(()=>refresh()).catch(()=>{})};
  const offline=()=>setIsOnline(false);
  window.addEventListener("online",online);window.addEventListener("offline",offline);
  return ()=>{window.removeEventListener("online",online);window.removeEventListener("offline",offline)};
 },[]);
 async function downloadForOffline(){
  if(!supabase||!navigator.onLine){setError("Connect to the internet to download the offline library.");return}
  setDownloadBusy(true);setError("");
  try{
   const snapshot=await syncOfflineContent();
   setSubjects(snapshot.subjects);setNotes(snapshot.notes);
   setNotice(`Downloaded ${snapshot.subjects.length} subjects, ${snapshot.notes.length} notes and ${snapshot.questions.length} questions for offline use.`);
   await syncPendingOfflineAttempts();
  }catch(e){setError(e instanceof Error?e.message:"Download failed. Please try again.")}
  finally{setDownloadBusy(false)}
 }
 useEffect(()=>{if(!subjectId&&subjects.length)setSubjectId(subjects[0].id)},[subjects,subjectId]);
 const subjectName=(id:string|null)=>subjects.find(s=>s.id===id)?.name||"General";
 const avg=attempts.length?attempts.reduce((v,a)=>v+Number(a.score_percent),0)/attempts.length:0;
 const count=attempts.reduce((v,a)=>v+Number(a.total_questions||0),0);
 const visibleNotes=useMemo(()=>notes.filter(n=>(n.title+" "+n.summary+" "+subjectName(n.subject_id)).toLowerCase().includes(search.toLowerCase())&&(!subjectId||n.subject_id===subjectId)),[notes,search,subjectId,subjects]);
 const nav=[["dashboard","Dashboard",LayoutDashboard],["study","Study notes",BookOpen],["quiz","Quiz activity",Brain],["past","Past questions",Clock3],["progress","My progress",Activity]] as const;
 function go(p:Page){setPage(p);setMobile(false);setError("");setNotice("");setActiveNote(null)}
 async function startQuiz(mode:"quiz"|"mock"="quiz",sid=subjectId,examYear:number|null=null){
  if(!sid){setError("Choose a subject first.");return}
  setBusy(true);setError("");setResult(null);setAnswers({});setReviews({});
  try{
   let snapshot=await getOfflineSnapshot();
   if(navigator.onLine&&supabase){
    try{snapshot=await syncOfflineContent();setSubjects(snapshot.subjects);setNotes(snapshot.notes)}catch{}
   }
   const pool=snapshot.questions.filter(q=>q.subject_id===sid&&(!examYear||(q.exam_type==="UTME"&&q.exam_year===examYear)));
   const shuffled=[...pool].sort(()=>Math.random()-.5);
   const chosen=shuffled.slice(0,Math.min(mode==="mock"?40:10,shuffled.length));
   if(!chosen.length){setError(examYear?`No ${examYear} questions for this subject have been downloaded yet.`:"No downloaded questions are available for this subject. Connect and download the offline library first.");return}
   const now=Date.now();setQuestions(chosen);setIndex(0);setQuizMode(mode);setExamStartedAt(now);
   setSecondsLeft(mode==="mock"?40*60:10*60);setStarted(true);setPage("quiz");
   await saveActiveExam({questions:chosen,answers:{},index:0,mode,subjectId:sid,startedAt:now,deadline:now+(mode==="mock"?40*60:10*60)*1000});
  }catch(e){setError(e instanceof Error?e.message:"Could not open offline questions.")}
  finally{setBusy(false)}
 }
 async function submitQuiz(){
  if(!questions.length)return;
  setBusy(true);setError("");
  try{
   const clientId=makeLocalId();
   const answerRows=questions.map(q=>({question_id:q.id,selected_option:answers[q.id]??null}));
   const correct=questions.filter(q=>answers[q.id]===q.correct_option).length;
   const now=new Date().toISOString();
   const duration=Math.max(0,Math.floor((Date.now()-examStartedAt)/1000));
   const localAttempt:OfflineAttempt={
    id:clientId,client_attempt_id:clientId,subject_id:questions[0].subject_id,mode:quizMode,
    started_at:new Date(examStartedAt).toISOString(),submitted_at:now,duration_seconds:duration,
    total_questions:questions.length,correct_answers:correct,score_percent:Number((correct/questions.length*100).toFixed(2)),
    answers:answerRows,synced:false
   };
   await saveOfflineAttempt(localAttempt);
   const next:Record<string,{correct_option:number;explanation:string}>={};
   for(const q of questions)next[q.id]={correct_option:q.correct_option,explanation:q.explanation||""};
   setReviews(next);
   setResult({score_percent:localAttempt.score_percent,correct_answers:correct,total_questions:questions.length});
   setStarted(false);await clearActiveExam();
   if(navigator.onLine&&supabase)await syncPendingOfflineAttempts();
   const local=await getLocalAttempts();
   setAttempts(local.map(a=>({id:a.client_attempt_id,client_attempt_id:a.client_attempt_id,subject_id:a.subject_id,score_percent:a.score_percent,correct_answers:a.correct_answers,total_questions:a.total_questions,started_at:a.started_at,mode:a.mode})));
   if(navigator.onLine&&supabase)refresh();
  }catch(e){setError(e instanceof Error?e.message:"Could not save this attempt on your device.")}
  finally{setBusy(false)}
 }
 useEffect(()=>{
  if(!started)return;
  const tick=()=>{const end=examStartedAt+(quizMode==="mock"?40*60:10*60)*1000;const left=Math.max(0,Math.ceil((end-Date.now())/1000));setSecondsLeft(left);if(left===0)submitQuiz()};
  tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);
 },[started,examStartedAt,quizMode]);
 async function saveQuestion(e:FormEvent){
  e.preventDefault();if(!supabase)return;setBusy(true);
  const {error:e1}=await supabase.from("questions").insert({subject_id:qForm.subject_id,question_text:qForm.question_text,options:[qForm.a,qForm.b,qForm.c,qForm.d],correct_option:Number(qForm.correct_option),explanation:qForm.explanation,exam_type:qForm.exam_type,exam_year:qForm.exam_year?Number(qForm.exam_year):null,source_label:"Admin supplied material",published:true,created_by:(await supabase.auth.getUser()).data.user?.id});
  if(e1)setError(e1.message);else{setNotice("Question published.");setQForm({...qForm,question_text:"",a:"",b:"",c:"",d:"",explanation:""})}setBusy(false);
 }
 async function saveNote(e:FormEvent){
  e.preventDefault();if(!supabase)return;setBusy(true);
  const {error:e1}=await supabase.from("study_notes").insert({...nForm,published:true,created_by:(await supabase.auth.getUser()).data.user?.id});
  if(e1)setError(e1.message);else{setNotice("Study note published.");setNForm({...nForm,title:"",summary:"",content:""});await refresh()}setBusy(false);
 }
 const current=questions[index];
 return <div className="fp-shell">
  <aside className={mobile?"fp-sidebar open":"fp-sidebar"}><div className="fp-brand"><span className="fp-logo"><GraduationCap/></span>Future<span>Path</span><button className="fp-close" onClick={()=>setMobile(false)}><X/></button></div><small className="fp-side-label">LEARNING SPACE</small>
   <nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?"fp-nav active":"fp-nav"} onClick={()=>go(id)}><Icon size={18}/>{label}</button>)}</nav>
   {profile?.role==="admin"&&<button className={page==="admin"?"fp-nav active":"fp-nav"} onClick={()=>go("admin")}><ShieldCheck size={18}/>Admin dashboard</button>}
   <div className="fp-side-bottom"><div className="fp-side-tip"><Target/><b>Keep moving forward</b><p>Consistent practice builds confidence.</p></div><button className="fp-nav" onClick={()=>supabase?.auth.signOut()}><LogOut size={18}/>Sign out</button></div>
  </aside>{mobile&&<button className="fp-scrim" onClick={()=>setMobile(false)}/>}
  <main className="fp-main"><header className="fp-topbar"><button className="fp-menu" onClick={()=>setMobile(true)}><Menu/></button><div><small>YOUR LEARNING SPACE</small><b>{page==="dashboard"?"Dashboard":page==="study"?"Study centre":page==="quiz"?"Quiz activity":page==="past"?"Past questions":page==="progress"?"My progress":"Admin dashboard"}</b></div><div className="fp-user"><span>{(profile?.full_name||"S")[0].toUpperCase()}</span><div><b>{profile?.full_name||"Student"}</b><small>{profile?.role==="admin"?"Administrator":"UTME Candidate"}</small></div></div></header>
   <div className="fp-content">{loading&&<p className="fp-loading">Loading your learning space…</p>}
    {error&&<div className="fp-alert error">{error}<button onClick={()=>setError("")}>×</button></div>}{notice&&<div className="fp-alert success">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
    {!loading&&page==="dashboard"&&<><section className="fp-welcome"><div><small>YOUR FUTURE STARTS HERE</small><h1>Welcome back, {profile?.full_name?.split(" ")[0]||"Student"}.</h1><p>Make every study session count. Your next step starts here.</p></div><GraduationCap size={54}/></section>
     <section className="fp-hero"><span>YOUR NEXT STEP</span><h2>Prepare with purpose.<br/>Progress with confidence.</h2><p>Practise UTME-style questions, revise key topics and follow your improvement.</p><button onClick={()=>startQuiz()}>Start a quick quiz <ChevronRight size={16}/></button></section>
     <section className="fp-stat-grid"><article><Trophy/><small>Average score</small><strong>{score(avg)}%</strong><em>Across your attempts</em></article><article><CheckCircle2/><small>Questions attempted</small><strong>{count}</strong><em>Keep practising</em></article><article><Activity/><small>Practice sessions</small><strong>{attempts.length}</strong><em>Your learning activity</em></article></section>
     <div className="fp-section-head"><div><h2>Explore your subjects</h2><p>Choose a subject to study or practise.</p></div></div><section className="fp-subject-grid">{subjects.map(s=><article key={s.id}><BookOpen/><h3>{s.name}</h3><p>{s.description}</p><div><button onClick={()=>{setSubjectId(s.id);go("study")}}>Study notes</button><button onClick={()=>{setSubjectId(s.id);startQuiz("quiz",s.id)}}>Take quiz</button></div></article>)}</section>
     <section className="fp-latest"><h2>Recent practice</h2>{attempts.slice(0,5).map(a=><div className="fp-attempt-row" key={a.id}><div><b>{subjectName(a.subject_id)} practice</b><small>{new Date(a.started_at).toLocaleDateString()}</small></div><strong>{score(Number(a.score_percent))}%</strong></div>)}{!attempts.length&&<p className="fp-empty">Your completed quizzes and scores will appear here.</p>}</section></>}
    {!loading&&page==="study"&&<section className="fp-page"><small>STUDY CENTRE</small><h1>Build your understanding.</h1><p>Explore topic-by-topic revision notes across your UTME subjects.</p><div className="fp-filter-row"><label><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes or topics"/></label><select value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>{activeNote?<article className="fp-note-reader"><button onClick={()=>setActiveNote(null)}>← All notes</button><small>{subjectName(activeNote.subject_id)}</small><h2>{activeNote.title}</h2><p>{activeNote.summary}</p><div className="fp-note-content">{activeNote.content.split("\n").map((line,i)=>line.startsWith("## ")?<h3 key={i}>{line.slice(3)}</h3>:line.startsWith("- ")?<p key={i}>• {line.slice(2).replaceAll("**","")}</p>:line?<p key={i}>{line.replaceAll("**","")}</p>:null)}</div><button className="fp-primary" onClick={()=>startQuiz("quiz",activeNote.subject_id)}>Practise this subject</button></article>:<div className="fp-note-grid">{visibleNotes.map(n=><article key={n.id}><small>{subjectName(n.subject_id)}</small><h3>{n.title}</h3><p>{n.summary}</p><button onClick={()=>setActiveNote(n)}>Read notes <ChevronRight size={15}/></button></article>)}{!visibleNotes.length&&<p className="fp-empty">No published notes match this filter yet.</p>}</div>}</section>}
    {!loading&&page==="quiz"&&<section className="fp-page"><small>PRACTICE ARENA</small><h1>Challenge your knowledge.</h1><p>Randomised questions and recorded progress.</p>{result?<article className="fp-result"><Trophy size={40}/><small>QUIZ COMPLETED</small><h2>{score(result.score_percent)}%</h2><p>You answered {result.correct_answers} out of {result.total_questions} questions correctly.</p><button className="fp-primary" onClick={()=>startQuiz()}>Try another quiz</button><button onClick={()=>go("progress")}>View progress</button><div className="fp-review-list">{questions.map((q,i)=><article key={q.id}><b>{i+1}. {q.question_text}</b><p className="fp-review-status">{reviews[q.id]&&answers[q.id]===reviews[q.id].correct_option?"Correct":"Review this answer"}</p><p>Correct answer: {letter(reviews[q.id]?.correct_option??0)}. {q.options[reviews[q.id]?.correct_option??0]}</p><small>{reviews[q.id]?.explanation||"No explanation has been added yet."}</small></article>)}</div></article>:!started?<div className="fp-quiz-start"><Brain size={34}/><h2>Ready for a quick challenge?</h2><p>Choose a subject and begin a fresh set of random questions.</p><label>Subject<select value={subjectId} onChange={e=>setSubjectId(e.target.value)}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="fp-primary" disabled={busy} onClick={()=>startQuiz()}>10-question quiz</button><button className="fp-secondary" disabled={busy} onClick={()=>startQuiz("mock")}>40-question mock</button></div>:current?<article className="fp-question-card"><div><b>{subjectName(current.subject_id)} · {current.topic_title||"General"}</b><strong>{index+1} / {questions.length}</strong></div><div className="fp-progress-track"><span style={{width:((index+1)/questions.length*100)+"%"}}/></div><h2>{current.question_text}</h2><div className="fp-options">{current.options.map((o,i)=><button key={i} className={answers[current.id]===i?"chosen":""} onClick={()=>setAnswers(a=>({...a,[current.id]:i}))}><b>{letter(i)}</b>{o}</button>)}</div><div className="fp-question-actions"><button className="fp-secondary" disabled={!index} onClick={()=>setIndex(i=>i-1)}>Previous</button>{index<questions.length-1?<button className="fp-primary" onClick={()=>setIndex(i=>i+1)}>Next question</button>:<button className="fp-primary" disabled={busy} onClick={submitQuiz}>{busy?"Submitting…":"Submit answers"}</button>}</div><small>Your answers are marked securely when submitted.</small></article>:null}</section>}
    {!loading&&page==="past"&&<section className="fp-page"><small>PAST QUESTION LIBRARY</small><h1>Prepare with past questions.</h1><p>Find available questions by subject and year.</p><div className="fp-past-filter"><label>Subject<select value={pastSubject||subjectId} onChange={e=>{setPastSubject(e.target.value);setSubjectId(e.target.value)}}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Year<select value={year} onChange={e=>setYear(e.target.value)}>{Array.from({length:16},(_,i)=>2026-i).map(y=><option key={y}>{y}</option>)}</select></label><button className="fp-primary" onClick={()=>startQuiz("quiz",pastSubject||subjectId,Number(year))}>Find questions</button></div><div className="fp-library-note"><BookOpen/><div><b>Question archive</b><p>We add verified, licensed or user-provided past-question materials and label each source accurately. The archive is being populated; original UTME-style practice is available in Quiz Activity.</p></div></div></section>}
    {!loading&&page==="progress"&&<section className="fp-page"><small>YOUR PERFORMANCE</small><h1>See how far you've come.</h1><p>Your recorded scores and activity.</p><section className="fp-stat-grid"><article><Trophy/><small>Average score</small><strong>{score(avg)}%</strong></article><article><CheckCircle2/><small>Questions attempted</small><strong>{count}</strong></article><article><Activity/><small>Sessions completed</small><strong>{attempts.length}</strong></article></section><section className="fp-latest"><h2>Score history</h2>{attempts.map(a=><div className="fp-attempt-row" key={a.id}><div><b>{subjectName(a.subject_id)} · {a.mode}</b><small>{new Date(a.started_at).toLocaleString()}</small></div><strong>{score(Number(a.score_percent))}%</strong></div>)}{!attempts.length&&<p className="fp-empty">Complete your first quiz to start seeing your growth.</p>}</section></section>}
    {!loading&&page==="admin"&&<section className="fp-page"><small>CONTENT MANAGEMENT</small><h1>Admin dashboard.</h1><p>Create and publish materials for students.</p>{profile?.role!=="admin"?<p className="fp-empty">Admin access is restricted. Assign your account the admin role securely in Supabase first.</p>:<><div className="fp-admin-tabs"><button className={adminTab==="question"?"selected":""} onClick={()=>setAdminTab("question")}>Add question</button><button className={adminTab==="note"?"selected":""} onClick={()=>setAdminTab("note")}>Add study note</button></div>{adminTab==="question"?<form className="fp-admin-form" onSubmit={saveQuestion}><h2>Publish a question</h2><label>Subject<select required value={qForm.subject_id} onChange={e=>setQForm(v=>({...v,subject_id:e.target.value}))}><option value="">Choose subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Question<textarea required value={qForm.question_text} onChange={e=>setQForm(v=>({...v,question_text:e.target.value}))}/></label><div className="fp-form-grid">{(["a","b","c","d"] as const).map(k=><label>Option {k.toUpperCase()}<input required value={qForm[k]} onChange={e=>setQForm(v=>({...v,[k]:e.target.value}))}/></label>)}</div><label>Correct answer<select value={qForm.correct_option} onChange={e=>setQForm(v=>({...v,correct_option:e.target.value}))}>{[0,1,2,3].map(i=><option value={i}>{letter(i)}</option>)}</select></label><label>Explanation<textarea value={qForm.explanation} onChange={e=>setQForm(v=>({...v,explanation:e.target.value}))}/></label><div className="fp-form-grid"><label>Type<select value={qForm.exam_type} onChange={e=>setQForm(v=>({...v,exam_type:e.target.value}))}><option>UTME</option><option>POST_UTME</option><option>PRACTICE</option></select></label><label>Year<input type="number" min="1980" max="2026" value={qForm.exam_year} onChange={e=>setQForm(v=>({...v,exam_year:e.target.value}))}/></label></div><button className="fp-primary" disabled={busy}>Publish question</button></form>:<form className="fp-admin-form" onSubmit={saveNote}><h2>Publish study notes</h2><label>Subject<select required value={nForm.subject_id} onChange={e=>setNForm(v=>({...v,subject_id:e.target.value}))}><option value="">Choose subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Title<input required value={nForm.title} onChange={e=>setNForm(v=>({...v,title:e.target.value}))}/></label><label>Summary<textarea value={nForm.summary} onChange={e=>setNForm(v=>({...v,summary:e.target.value}))}/></label><label>Full notes<textarea required rows={12} value={nForm.content} onChange={e=>setNForm(v=>({...v,content:e.target.value}))}/></label><button className="fp-primary" disabled={busy}>Publish notes</button></form>}</>}</section>}
    <footer className="fp-footer">© 2026 FuturePath <span>Learn with purpose. Prepare with confidence.</span></footer>
   </div>
  </main>
 </div>
}
