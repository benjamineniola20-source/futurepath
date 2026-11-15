import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Activity, BookOpen, Brain, CheckCircle2, ChevronRight, Clock3, GraduationCap, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, Target, Trophy, X } from "lucide-react";
import { supabase } from "./lib/supabase";
import {
  clearActiveExam, getActiveExam, getLocalAttempts, getOfflineAccount, getOfflineSnapshot, makeLocalId,
  saveActiveExam, saveOfflineAttempt, syncOfflineContent, syncPendingOfflineAttempts,
  type OfflineAttempt, type OfflineQuestion
} from "./lib/offline";

type Subject={id:string;name:string;slug:string;description:string};
type Topic={id:string;subject_id:string;title:string;slug:string;description:string;sort_order:number};
type Note={id:string;subject_id:string;topic_id?:string|null;title:string;summary:string;content:string;published?:boolean};
type Question=OfflineQuestion;
type Attempt={id:string;client_attempt_id?:string;subject_id:string|null;score_percent:number;correct_answers:number;total_questions:number;started_at:string;mode:string};
type AdminStudent={id:string;full_name:string;role:string;created_at:string};
type AdminAttempt=Attempt&{user_id:string;submitted_at:string};
type AdminQuestion={id:string;subject_id:string;topic_id:string|null;question_text:string;options:string[];correct_option:number;explanation:string;published:boolean;exam_type:string;exam_year:number|null;source_label:string;created_at:string};
type AdminNote={id:string;subject_id:string;topic_id:string|null;title:string;summary:string;content:string;published:boolean;created_at:string};
type Page="dashboard"|"study"|"quiz"|"past"|"progress"|"admin";
const letter=(i:number)=>String.fromCharCode(65+i);
const score=(n:number)=>Number(n||0).toFixed(1);

export default function App(){
 const [page,setPage]=useState<Page>("dashboard"),[subjects,setSubjects]=useState<Subject[]>([]),[topics,setTopics]=useState<Topic[]>([]),[notes,setNotes]=useState<Note[]>([]),[attempts,setAttempts]=useState<Attempt[]>([]);
 const [profile,setProfile]=useState<{full_name:string;role:string}|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [subjectId,setSubjectId]=useState(""),[search,setSearch]=useState(""),[activeNote,setActiveNote]=useState<Note|null>(null),[activeTopic,setActiveTopic]=useState<Topic|null>(null),[mobile,setMobile]=useState(false);
 const [questions,setQuestions]=useState<Question[]>([]),[answers,setAnswers]=useState<Record<string,number>>({}),[reviews,setReviews]=useState<Record<string,{correct_option:number;explanation:string}>>({}),[index,setIndex]=useState(0),[started,setStarted]=useState(false),[result,setResult]=useState<{score_percent:number;correct_answers:number;total_questions:number}|null>(null),[busy,setBusy]=useState(false);
 const [year,setYear]=useState("2023"),[pastSubject,setPastSubject]=useState("");
 const [isOnline,setIsOnline]=useState(typeof navigator==="undefined"?true:navigator.onLine),[questionBankCount,setQuestionBankCount]=useState(0);
 const [quizMode,setQuizMode]=useState<"quiz"|"mock">("quiz"),[examStartedAt,setExamStartedAt]=useState(0),[secondsLeft,setSecondsLeft]=useState(0);
 const submittingRef=useRef(false);
 const submitQuizRef=useRef<()=>Promise<void>>(async()=>{});
 const [adminTab,setAdminTab]=useState<"overview"|"students"|"performance"|"questions"|"content"|"import"|"note"|"question">("overview");
 const [adminStudents,setAdminStudents]=useState<AdminStudent[]>([]),[adminAttempts,setAdminAttempts]=useState<AdminAttempt[]>([]),[adminQuestions,setAdminQuestions]=useState<AdminQuestion[]>([]),[adminNotes,setAdminNotes]=useState<AdminNote[]>([]);
 const [editingQuestionId,setEditingQuestionId]=useState<string|null>(null);
 const [importText,setImportText]=useState("");
 const [importSubjectId,setImportSubjectId]=useState("");
 const [importYear,setImportYear]=useState("");
 const [importSource,setImportSource]=useState("Original FuturePath practice material — not official JAMB");
 const [importFileName,setImportFileName]=useState("");
 const [qForm,setQForm]=useState({subject_id:"",question_text:"",a:"",b:"",c:"",d:"",correct_option:"0",explanation:"",exam_type:"PRACTICE",exam_year:""});
 const [nForm,setNForm]=useState({subject_id:"",title:"",summary:"",content:""});
 async function refresh(){
  setLoading(true);
  try {
   const cached=await getOfflineSnapshot();
   if(cached.subjects.length)setSubjects(cached.subjects);
   setQuestionBankCount(cached.questions.length);
   if(cached.topics.length)setTopics(cached.topics);
   if(cached.notes.length)setNotes(cached.notes);
   const local=await getLocalAttempts();
   if(!navigator.onLine||!supabase){
    const account=await getOfflineAccount();
    if(account)setProfile({full_name:account.full_name||"",role:"student"});
    setAttempts(local.map(a=>({id:a.client_attempt_id,client_attempt_id:a.client_attempt_id,subject_id:a.subject_id,score_percent:a.score_percent,correct_answers:a.correct_answers,total_questions:a.total_questions,started_at:a.started_at,mode:a.mode})));
    setLoading(false);return;
   }
   try {
    const fresh=await syncOfflineContent();
    setSubjects(fresh.subjects);setTopics(fresh.topics);setNotes(fresh.notes);setQuestionBankCount(fresh.questions.length);
   } catch (contentError) {
    if(!cached.subjects.length)setError(contentError instanceof Error?contentError.message:"Could not download learning content.");
   }
   await syncPendingOfflineAttempts();
   const [p,a]=await Promise.all([
    supabase.from("profiles").select("full_name,role").eq("id",(await supabase.auth.getUser()).data.user?.id||"").maybeSingle(),
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
  getActiveExam<{questions:Question[];answers:Record<string,number>;index:number;mode:"quiz"|"mock";subjectId:string;startedAt:number;deadline:number}>()
   .then(exam=>{
    if(!exam)return;
    setQuestions(exam.questions);setAnswers(exam.answers||{});setIndex(exam.index||0);
    setQuizMode(exam.mode);setSubjectId(exam.subjectId);setExamStartedAt(exam.startedAt);
    setStarted(true);setPage("quiz");
   }).catch(()=>{});
 },[]);
 useEffect(()=>{
  if(started&&questions.length){
   saveActiveExam({questions,answers,index,mode:quizMode,subjectId:questions[0].subject_id,startedAt:examStartedAt,deadline:examStartedAt+(quizMode==="mock"?40*60:10*60)*1000}).catch(()=>{});
  }
 },[started,questions,answers,index,quizMode,examStartedAt]);
 useEffect(()=>{
  const syncWhenAvailable=()=>{if(navigator.onLine){setIsOnline(true);syncPendingOfflineAttempts().then(()=>refresh()).catch(()=>{})}};
  const online=()=>syncWhenAvailable();
  const offline=()=>setIsOnline(false);
  const visible=()=>{if(document.visibilityState==="visible")syncWhenAvailable()};
  window.addEventListener("online",online);window.addEventListener("offline",offline);
  window.addEventListener("focus",syncWhenAvailable);document.addEventListener("visibilitychange",visible);
  return ()=>{
   window.removeEventListener("online",online);window.removeEventListener("offline",offline);
   window.removeEventListener("focus",syncWhenAvailable);document.removeEventListener("visibilitychange",visible);
  };
 },[]);
 useEffect(()=>{if(!subjectId&&subjects.length)setSubjectId(subjects[0].id)},[subjects,subjectId]);
 const subjectName=(id:string|null)=>subjects.find(s=>s.id===id)?.name||"General";
 const avg=attempts.length?attempts.reduce((v,a)=>v+Number(a.score_percent),0)/attempts.length:0;
 const count=attempts.reduce((v,a)=>v+Number(a.total_questions||0),0);
 const visibleNotes=useMemo(()=>notes.filter(n=>(n.title+" "+n.summary+" "+subjectName(n.subject_id)).toLowerCase().includes(search.toLowerCase())&&(!subjectId||n.subject_id===subjectId)&&(!activeTopic||n.topic_id===activeTopic.id)),[notes,search,subjectId,subjects,activeTopic]);
 const visibleTopics=useMemo(()=>topics.filter(t=>(!subjectId||t.subject_id===subjectId)&&(t.title+" "+t.description+" "+subjectName(t.subject_id)).toLowerCase().includes(search.toLowerCase())),[topics,subjectId,search,subjects]);
 const nav=[["dashboard","Dashboard",LayoutDashboard],["study","Study notes",BookOpen],["quiz","Quiz activity",Brain],["past","Question bank",Clock3],["progress","My progress",Activity]] as const;
 function go(p:Page){setPage(p);setMobile(false);setError("");setNotice("");setActiveNote(null)}
 async function startQuiz(mode:"quiz"|"mock"="quiz",sid=subjectId,examYear:number|null=null){
  if(!sid){setError("Choose a subject first.");return}
  setBusy(true);setError("");setResult(null);setAnswers({});setReviews({});
  try{
   let snapshot=await getOfflineSnapshot();
   if(navigator.onLine&&supabase){
    try{snapshot=await syncOfflineContent();setSubjects(snapshot.subjects);setNotes(snapshot.notes);setQuestionBankCount(snapshot.questions.length)}catch{}
   }
   const pool=snapshot.questions.filter(q=>q.subject_id===sid&&(!examYear||(q.exam_type==="UTME"&&q.exam_year===examYear)));
   const shuffled=[...pool].sort(()=>Math.random()-.5);
   const chosen=shuffled.slice(0,Math.min(mode==="mock"?40:10,shuffled.length));
   if(!chosen.length){setError(examYear?`No ${examYear} questions for this subject have been downloaded yet.`:"No bundled practice questions are available for this subject yet.");return}
   const now=Date.now();setQuestions(chosen);setIndex(0);setQuizMode(mode);setExamStartedAt(now);
   setSecondsLeft(mode==="mock"?40*60:10*60);setStarted(true);setPage("quiz");
   await saveActiveExam({questions:chosen,answers:{},index:0,mode,subjectId:sid,startedAt:now,deadline:now+(mode==="mock"?40*60:10*60)*1000});
  }catch(e){setError(e instanceof Error?e.message:"Could not open offline questions.")}
  finally{setBusy(false)}
 }
 async function submitQuiz(){
  if(!questions.length||submittingRef.current)return;
  submittingRef.current=true;setBusy(true);setError("");
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
  finally{setBusy(false);submittingRef.current=false}
 }
 submitQuizRef.current=submitQuiz;
 useEffect(()=>{
  if(!started)return;
  const tick=()=>{const end=examStartedAt+(quizMode==="mock"?40*60:10*60)*1000;const left=Math.max(0,Math.ceil((end-Date.now())/1000));setSecondsLeft(left);if(left===0)submitQuizRef.current()};
  tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);
 },[started,examStartedAt,quizMode]);
 async function refreshAdminData(){
  if(!supabase||profile?.role!=="admin")return;
  const [s,a,q,n]=await Promise.all([
   supabase.from("profiles").select("id,full_name,role,created_at").order("created_at",{ascending:false}).limit(500),
   supabase.from("attempts").select("id,user_id,subject_id,score_percent,correct_answers,total_questions,started_at,submitted_at,mode").order("submitted_at",{ascending:false}).limit(500),
   supabase.from("questions").select("id,subject_id,topic_id,question_text,options,correct_option,explanation,published,exam_type,exam_year,source_label,created_at").order("created_at",{ascending:false}).limit(500),
   supabase.from("study_notes").select("id,subject_id,topic_id,title,summary,content,published,created_at").order("created_at",{ascending:false}).limit(300)
  ]);
  const err=s.error||a.error||q.error||n.error;if(err)throw err;
  setAdminStudents((s.data||[]) as AdminStudent[]);setAdminAttempts((a.data||[]) as AdminAttempt[]);setAdminQuestions((q.data||[]) as AdminQuestion[]);setAdminNotes((n.data||[]) as AdminNote[]);
 }
 useEffect(()=>{if(page==="admin"&&profile?.role==="admin")refreshAdminData().catch(e=>setError(e.message||"Could not load admin data."))},[page,profile?.role]);
 async function saveQuestion(e:FormEvent){
  e.preventDefault();if(!supabase)return;setBusy(true);
  const payload={subject_id:qForm.subject_id,question_text:qForm.question_text,options:[qForm.a,qForm.b,qForm.c,qForm.d],correct_option:Number(qForm.correct_option),explanation:qForm.explanation,exam_type:qForm.exam_type,exam_year:qForm.exam_year?Number(qForm.exam_year):null,source_label:"Admin supplied material",published:true,...(!editingQuestionId?{created_by:(await supabase.auth.getUser()).data.user?.id}:{})};
  const response=editingQuestionId?await supabase.from("questions").update(payload).eq("id",editingQuestionId):await supabase.from("questions").insert(payload);
  if(response.error)setError(response.error.message);else{setNotice(editingQuestionId?"Question updated and published.":"Question published.");setEditingQuestionId(null);setQForm({...qForm,question_text:"",a:"",b:"",c:"",d:"",explanation:""});await refreshAdminData()}setBusy(false);
 }
 function editAdminQuestion(q:AdminQuestion){setEditingQuestionId(q.id);setQForm({subject_id:q.subject_id,question_text:q.question_text,a:q.options?.[0]||"",b:q.options?.[1]||"",c:q.options?.[2]||"",d:q.options?.[3]||"",correct_option:String(q.correct_option),explanation:q.explanation||"",exam_type:q.exam_type,exam_year:q.exam_year?String(q.exam_year):""});setAdminTab("question")}
 async function toggleQuestion(q:AdminQuestion){if(!supabase)return;const {error:e}=await supabase.from("questions").update({published:!q.published}).eq("id",q.id);if(e)setError(e.message);else{setNotice(q.published?"Question unpublished.":"Question published.");await refreshAdminData()}}
 async function deleteQuestion(q:AdminQuestion){if(!supabase||!window.confirm("Delete this question permanently?"))return;const {error:e}=await supabase.from("questions").delete().eq("id",q.id);if(e)setError(e.message);else{setNotice("Question deleted.");await refreshAdminData()}}
 async function toggleNote(n:AdminNote){if(!supabase)return;const {error:e}=await supabase.from("study_notes").update({published:!n.published}).eq("id",n.id);if(e)setError(e.message);else{setNotice(n.published?"Study note unpublished.":"Study note published.");await refreshAdminData()}}
 async function deleteNote(n:AdminNote){if(!supabase||!window.confirm("Delete this study note permanently?"))return;const {error:e}=await supabase.from("study_notes").delete().eq("id",n.id);if(e)setError(e.message);else{setNotice("Study note deleted.");await refreshAdminData()}}
 async function loadImportFile(file?:File){
  if(!file)return;
  setImportFileName(file.name);
  const text=await file.text();
  if(file.name.toLowerCase().endsWith(".json")){
   try{setImportText(JSON.stringify(JSON.parse(text),null,2))}
   catch{setError("That JSON file is not valid.")}
  }else setImportText(text);
 }
 function parseQuestionImport(raw:string){
  const trimmed=raw.trim();
  if(!trimmed)throw new Error("Paste or select a question file first.");
  if(trimmed.startsWith("[")||trimmed.startsWith("{")){
   const parsed=JSON.parse(trimmed);
   const rows=Array.isArray(parsed)?parsed:(parsed.questions||[]);
   return rows.map((r:any)=>({
    question_text:String(r.question_text||r.question||"").trim(),
    options:Array.isArray(r.options)?r.options:[r.a,r.b,r.c,r.d],
    correct_option:typeof r.correct_option==="number"?r.correct_option:"ABCD".indexOf(String(r.correct_option||r.answer||r.correct_answer||"").trim().toUpperCase()),
    explanation:String(r.explanation||""),
    exam_year:r.exam_year?Number(r.exam_year):(Number(importYear)||null)
   }));
  }
  return trimmed.split(/\\n\\s*---+\\s*\\n/g).map(block=>{
   const value=(key:string)=>block.match(new RegExp("^\\s*"+key+"\\s*:\\s*(.+)$","im"))?.[1]?.trim()||"";
   const question=(block.match(/^\\s*Question\\s*:\\s*([\\s\\S]*?)(?=^\\s*A\\s*[:.)]|$)/im)?.[1]||"").trim();
   const options=["A","B","C","D"].map(k=>value(k));
   const answer=value("Answer").toUpperCase().replace(/[^A-D]/g,"");
   return {question_text:question,options,correct_option:"ABCD".indexOf(answer[0]||""),explanation:value("Explanation"),exam_year:Number(value("Year")||importYear)||null};
  });
 }
 async function importQuestions(e:FormEvent){
  e.preventDefault();
  if(!supabase)return;
  if(!importSubjectId){setError("Choose the subject for this question batch.");return}
  setBusy(true);setError("");
  try{
   const parsed=parseQuestionImport(importText);
   if(!parsed.length)throw new Error("No questions were found in the import.");
   const {data:authData}=await supabase.auth.getUser();
   const createdBy=authData.user?.id;
   const rows=parsed.map((q:any)=>({
    subject_id:importSubjectId,question_text:q.question_text,options:q.options,
    correct_option:q.correct_option,explanation:q.explanation||'',
    exam_type:'PRACTICE',exam_year:q.exam_year||null,
    source_label:importSource,published:true,created_by:createdBy
   }));
   const invalid=rows.findIndex((q:any)=>!q.question_text||!Array.isArray(q.options)||q.options.length!==4||q.options.some((o:any)=>!String(o||"").trim())||![0,1,2,3].includes(q.correct_option));
   if(invalid>=0)throw new Error("Question "+(invalid+1)+" is incomplete. Each question needs its text, four options (A–D), and a valid answer.");
   const {error:insertError}=await supabase.from("questions").insert(rows);
   if(insertError)throw insertError;
   setNotice("Successfully imported and published "+rows.length+" questions. They will be available after the next content sync. Bundling them into a new installable app requires a new app build.");
   setImportText("");setImportFileName("");await refreshAdminData();
  }catch(err){
   setError(err instanceof Error?err.message:"Import failed. Check the file format and try again.");
  }finally{setBusy(false)}
 }
 async function saveNote(e:FormEvent){
  e.preventDefault();if(!supabase)return;setBusy(true);
  const {error:e1}=await supabase.from("study_notes").insert({...nForm,published:true,created_by:(await supabase.auth.getUser()).data.user?.id});
  if(e1)setError(e1.message);else{setNotice("Study note published.");setNForm({...nForm,title:"",summary:"",content:""});await refresh();await refreshAdminData()}setBusy(false);
 }
 const current=questions[index];
 return <div className="fp-shell">
  <aside className={mobile?"fp-sidebar open":"fp-sidebar"}><div className="fp-brand"><span className="fp-logo"><GraduationCap/></span>Future<span>Path</span><button className="fp-close" onClick={()=>setMobile(false)}><X/></button></div><small className="fp-side-label">LEARNING SPACE</small>
   <nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?"fp-nav active":"fp-nav"} onClick={()=>go(id)}><Icon size={18}/>{label}</button>)}</nav>
   {profile?.role==="admin"&&<button className={page==="admin"?"fp-nav active":"fp-nav"} onClick={()=>go("admin")}><ShieldCheck size={18}/>Admin dashboard</button>}
   <div className="fp-side-bottom"><div className="fp-side-tip"><Target/><b>Keep moving forward</b><p>Consistent practice builds confidence.</p></div><button className="fp-nav" onClick={()=>supabase?.auth.signOut()}><LogOut size={18}/>Sign out</button></div>
  </aside>{mobile&&<button className="fp-scrim" onClick={()=>setMobile(false)}/>}
  <main className="fp-main"><header className="fp-topbar"><button className="fp-menu" onClick={()=>setMobile(true)}><Menu/></button><div><small>YOUR LEARNING SPACE</small><b>{page==="dashboard"?"Dashboard":page==="study"?"Study centre":page==="quiz"?"Quiz activity":page==="past"?"Question bank":page==="progress"?"My progress":"Admin dashboard"}</b></div><div className="fp-user"><span>{(profile?.full_name||"S")[0].toUpperCase()}</span><div><b>{profile?.full_name||"Student"}</b><small>{profile?.role==="admin"?"Administrator":"UTME Candidate"}</small></div></div></header>
   <div className="fp-content">
    <div className="fp-offline-tools"><span className={isOnline?"fp-online":"fp-offline"}>{isOnline?"● Online — learning library included with the app":"● Offline — learning library available on this device"}</span><span>Core learning materials are built into this app.</span></div>
    {loading&&<p className="fp-loading">Loading your learning space…</p>}
    {error&&<div className="fp-alert error">{error}<button onClick={()=>setError("")}>×</button></div>}{notice&&<div className="fp-alert success">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
    {!loading&&page==="dashboard"&&<><section className="fp-welcome"><div><small>YOUR FUTURE STARTS HERE</small><h1>Welcome back, {profile?.full_name?.split(" ")[0]||"Student"}.</h1><p>Make every study session count. Your next step starts here.</p></div><GraduationCap size={54}/></section>
     <section className="fp-hero"><span>YOUR NEXT STEP</span><h2>Prepare with purpose.<br/>Progress with confidence.</h2><p>Practise UTME-style questions, revise key topics and follow your improvement.</p><button onClick={()=>startQuiz()}>Start a quick quiz <ChevronRight size={16}/></button></section>
     <section className="fp-stat-grid"><article><Trophy/><small>Average score</small><strong>{score(avg)}%</strong><em>Across your attempts</em></article><article><CheckCircle2/><small>Questions attempted</small><strong>{count}</strong><em>Keep practising</em></article><article><Activity/><small>Practice sessions</small><strong>{attempts.length}</strong><em>Your learning activity</em></article></section>
     <div className="fp-section-head"><div><h2>Explore your subjects</h2><p>Choose a subject to study or practise.</p></div></div><section className="fp-subject-grid">{subjects.map(s=><article key={s.id}><BookOpen/><h3>{s.name}</h3><p>{s.description}</p><div><button onClick={()=>{setSubjectId(s.id);go("study")}}>Study notes</button><button onClick={()=>{setSubjectId(s.id);startQuiz("quiz",s.id)}}>Take quiz</button></div></article>)}</section>
     <section className="fp-latest"><h2>Recent practice</h2>{attempts.slice(0,5).map(a=><div className="fp-attempt-row" key={a.id}><div><b>{subjectName(a.subject_id)} practice</b><small>{new Date(a.started_at).toLocaleDateString()}</small></div><strong>{score(Number(a.score_percent))}%</strong></div>)}{!attempts.length&&<p className="fp-empty">Your completed quizzes and scores will appear here.</p>}</section></>}
    {!loading&&page==="study"&&<section className="fp-page"><small>STUDY CENTRE</small><h1>Build your understanding.</h1><p>Explore topic-by-topic revision notes across your UTME subjects.</p><div className="fp-filter-row"><label><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes or topics"/></label><select value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>{activeNote?<article className="fp-note-reader"><button onClick={()=>setActiveNote(null)}>← All study materials</button><small>{subjectName(activeNote.subject_id)}</small><h2>{activeNote.title}</h2><p>{activeNote.summary}</p><div className="fp-note-content">{activeNote.content.split("\n").map((line,i)=>line.startsWith("## ")?<h3 key={i}>{line.slice(3)}</h3>:line.startsWith("- ")?<p key={i}>• {line.slice(2).replace(/\*\*/g,"")}</p>:line?<p key={i}>{line.replace(/\*\*/g,"")}</p>:null)}</div><button className="fp-primary" onClick={()=>startQuiz("quiz",activeNote.subject_id)}>Practise this subject</button></article>:activeTopic?<article className="fp-note-reader"><button onClick={()=>setActiveTopic(null)}>← All topics</button><small>{subjectName(activeTopic.subject_id)} · TOPIC</small><h2>{activeTopic.title}</h2><p>{activeTopic.description}</p><h3>Study materials</h3>{visibleNotes.length?visibleNotes.map(n=><article key={n.id}><b>{n.title}</b><p>{n.summary}</p><button onClick={()=>setActiveNote(n)}>Read this note <ChevronRight size={15}/></button></article>):<p className="fp-empty">The topic has been added to the FuturePath syllabus map. Full lesson notes and topic-specific questions are being prepared and will be added in stages.</p>}<button className="fp-primary" onClick={()=>startQuiz("quiz",activeTopic.subject_id)}>Practise this subject</button></article>:<><div className="fp-section-head"><div><h2>{subjectId?subjectName(subjectId)+" topics":"All UTME subjects and topics"}</h2><p>{subjects.length} subjects · {topics.length} syllabus topic areas</p></div></div><div className="fp-topic-grid">{visibleTopics.map(t=><article key={t.id}><small>{subjectName(t.subject_id)}</small><h3>{t.title}</h3><p>{t.description}</p><button onClick={()=>setActiveTopic(t)}>Open topic <ChevronRight size={15}/></button></article>)}{!visibleTopics.length&&<p className="fp-empty">No topics match this search.</p>}</div><div className="fp-section-head"><div><h2>Available study notes</h2><p>Read downloaded notes offline.</p></div></div><div className="fp-note-grid">{visibleNotes.map(n=><article key={n.id}><small>{subjectName(n.subject_id)}</small><h3>{n.title}</h3><p>{n.summary}</p><button onClick={()=>setActiveNote(n)}>Read notes <ChevronRight size={15}/></button></article>)}{!visibleNotes.length&&<p className="fp-empty">More complete lesson notes are being added topic by topic.</p>}</div></>}</section>}
    {!loading&&page==="quiz"&&<section className="fp-page"><small>PRACTICE ARENA</small><h1>Challenge your knowledge.</h1><p>Randomised questions and recorded progress.</p>{result?<article className="fp-result"><Trophy size={40}/><small>QUIZ COMPLETED</small><h2>{score(result.score_percent)}%</h2><p>You answered {result.correct_answers} out of {result.total_questions} questions correctly.</p><button className="fp-primary" onClick={()=>startQuiz()}>Try another quiz</button><button onClick={()=>go("progress")}>View progress</button><div className="fp-review-list">{questions.map((q,i)=><article key={q.id}><b>{i+1}. {q.question_text}</b><p className="fp-review-status">{reviews[q.id]&&answers[q.id]===reviews[q.id].correct_option?"Correct":"Review this answer"}</p><p>Correct answer: {letter(reviews[q.id]?.correct_option??0)}. {q.options[reviews[q.id]?.correct_option??0]}</p><small>{reviews[q.id]?.explanation||"No explanation has been added yet."}</small></article>)}</div></article>:!started?<div className="fp-quiz-start"><Brain size={34}/><h2>Ready for a quick challenge?</h2><p>Choose a subject and begin a fresh set of random questions.</p><label>Subject<select value={subjectId} onChange={e=>setSubjectId(e.target.value)}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="fp-primary" disabled={busy} onClick={()=>startQuiz()}>10-question quiz</button><button className="fp-secondary" disabled={busy} onClick={()=>startQuiz("mock")}>40-question mock</button></div>:current?<article className="fp-question-card"><div><b>{subjectName(current.subject_id)} · {current.topic_title||"General"}</b><strong>{index+1} / {questions.length}</strong></div><div className="fp-progress-track"><span style={{width:((index+1)/questions.length*100)+"%"}}/></div><div className="fp-exam-meta"><span>Time remaining</span><strong>{String(Math.floor(secondsLeft/60)).padStart(2,"0")}:{String(secondsLeft%60).padStart(2,"0")}</strong></div><h2>{current.question_text}</h2><div className="fp-options">{current.options.map((o,i)=><button key={i} className={answers[current.id]===i?"chosen":""} onClick={()=>setAnswers(a=>({...a,[current.id]:i}))}><b>{letter(i)}</b>{o}</button>)}</div><div className="fp-question-actions"><button className="fp-secondary" disabled={!index} onClick={()=>setIndex(i=>i-1)}>Previous</button>{index<questions.length-1?<button className="fp-primary" onClick={()=>setIndex(i=>i+1)}>Next question</button>:<button className="fp-primary" disabled={busy} onClick={submitQuiz}>{busy?"Submitting…":"Submit answers"}</button>}</div><small>Your answers are marked on this device. Your result will sync when internet returns.</small></article>:null}</section>}
    {!loading&&page==="past"&&<section className="fp-page"><small>UTME QUESTION BANK</small><h1>Practise by subject.</h1><p>Choose any of the 25 UTME subjects and practise the questions currently available in FuturePath. Current question bank: {questionBankCount} questions across {subjects.length} subjects.</p><div className="fp-past-filter"><label>Subject<select value={pastSubject||subjectId} onChange={e=>{setPastSubject(e.target.value);setSubjectId(e.target.value)}}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="fp-primary" onClick={()=>startQuiz("quiz",pastSubject||subjectId)}>Practise questions</button></div><div className="fp-library-note"><BookOpen/><div><b>Question bank status</b><p>The current bank contains original UTME-style practice questions with answers and explanations. These are not historical JAMB past questions. Verified year-labelled JAMB papers will appear separately when authorised source papers are available.</p></div></div></section>}
    {!loading&&page==="progress"&&<section className="fp-page"><small>YOUR PERFORMANCE</small><h1>See how far you've come.</h1><p>Your recorded scores and activity.</p><section className="fp-stat-grid"><article><Trophy/><small>Average score</small><strong>{score(avg)}%</strong></article><article><CheckCircle2/><small>Questions attempted</small><strong>{count}</strong></article><article><Activity/><small>Sessions completed</small><strong>{attempts.length}</strong></article></section><section className="fp-latest"><h2>Score history</h2>{attempts.map(a=><div className="fp-attempt-row" key={a.id}><div><b>{subjectName(a.subject_id)} · {a.mode}</b><small>{new Date(a.started_at).toLocaleString()}</small></div><strong>{score(Number(a.score_percent))}%</strong></div>)}{!attempts.length&&<p className="fp-empty">Complete your first quiz to start seeing your growth.</p>}</section></section>}
    {!loading&&page==="admin"&&<section className="fp-page fp-admin-page"><small>CONTROL CENTRE</small><h1>Admin dashboard.</h1><p>Monitor student activity, learning performance and published content.</p>{profile?.role!=="admin"?<p className="fp-empty">Admin access is restricted. Assign your account the admin role securely in Supabase first.</p>:<>
      <div className="fp-admin-nav">{([["overview","Overview"],["students","Student activity"],["performance","Performance"],["questions","Question management"],["content","Study content"]] as const).map(([id,label])=><button key={id} className={adminTab===id?"selected":""} onClick={()=>setAdminTab(id)}>{label}</button>)}</div>
      {adminTab==="overview"&&<><section className="fp-stat-grid fp-admin-stats"><article><GraduationCap/><small>Registered students</small><strong>{adminStudents.filter(s=>s.role==="student").length}</strong><em>Student accounts</em></article><article><Activity/><small>Practice attempts</small><strong>{adminAttempts.length}</strong><em>Recorded submissions</em></article><article><Brain/><small>Published questions</small><strong>{adminQuestions.filter(q=>q.published).length}</strong><em>{adminQuestions.length} total in management</em></article><article><BookOpen/><small>Published study notes</small><strong>{adminNotes.filter(n=>n.published).length}</strong><em>{adminNotes.length} notes total</em></article></section>
       <div className="fp-admin-overview-grid"><article className="fp-admin-panel"><h2>Recent student activity</h2>{adminAttempts.slice(0,7).map(a=><div className="fp-admin-row" key={a.id}><div><b>{adminStudents.find(s=>s.id===a.user_id)?.full_name||"Student account"}</b><small>{subjectName(a.subject_id)} · {a.mode} · {new Date(a.submitted_at||a.started_at).toLocaleString()}</small></div><strong>{score(Number(a.score_percent))}%</strong></div>)}{!adminAttempts.length&&<p className="fp-empty">Student practice submissions will appear here.</p>}</article>
       <article className="fp-admin-panel"><h2>Question bank by subject</h2>{subjects.map(s=>{const n=adminQuestions.filter(q=>q.subject_id===s.id&&q.published).length;return <div className="fp-admin-subject" key={s.id}><span>{s.name}</span><b>{n}</b></div>})}</article></div>
      </>}
      {adminTab==="students"&&<article className="fp-admin-panel"><div className="fp-admin-panel-head"><div><h2>Student accounts</h2><p>Registration details and recent practice activity</p></div><strong>{adminStudents.filter(s=>s.role==="student").length} students</strong></div><div className="fp-admin-table-wrap"><table className="fp-admin-table"><thead><tr><th>Student</th><th>Joined</th><th>Practice sessions</th><th>Average score</th><th>Last activity</th></tr></thead><tbody>{adminStudents.filter(s=>s.role==="student").map(s=>{const list=adminAttempts.filter(a=>a.user_id===s.id);const average=list.length?list.reduce((v,a)=>v+Number(a.score_percent),0)/list.length:0;return <tr key={s.id}><td><b>{s.full_name||"Student"}</b></td><td>{new Date(s.created_at).toLocaleDateString()}</td><td>{list.length}</td><td>{score(average)}%</td><td>{list[0]?new Date(list[0].submitted_at||list[0].started_at).toLocaleDateString():"No attempts yet"}</td></tr>})}</tbody></table></div>{!adminStudents.some(s=>s.role==="student")&&<p className="fp-empty">No student accounts are available to display.</p>}</article>}
      {adminTab==="performance"&&<><section className="fp-stat-grid"><article><Trophy/><small>Overall average</small><strong>{adminAttempts.length?score(adminAttempts.reduce((v,a)=>v+Number(a.score_percent),0)/adminAttempts.length):"0.0"}%</strong></article><article><CheckCircle2/><small>Questions answered</small><strong>{adminAttempts.reduce((v,a)=>v+Number(a.total_questions||0),0)}</strong></article><article><Target/><small>Active learners (30 days)</small><strong>{new Set(adminAttempts.filter(a=>Date.now()-new Date(a.submitted_at||a.started_at).getTime()<=30*86400000).map(a=>a.user_id)).size}</strong></article></section><article className="fp-admin-panel"><h2>Performance by subject</h2>{subjects.map(s=>{const list=adminAttempts.filter(a=>a.subject_id===s.id);const average=list.length?list.reduce((v,a)=>v+Number(a.score_percent),0)/list.length:0;return <div className="fp-performance-row" key={s.id}><div><b>{s.name}</b><small>{list.length} attempts · average {score(average)}%</small></div><div className="fp-performance-track"><span style={{width:Math.max(0,Math.min(100,average))+"%"}}/></div></div>})}</article></>}
      {adminTab==="questions"&&<><div className="fp-admin-toolbar"><button className="fp-primary" onClick={()=>{setEditingQuestionId(null);setQForm({subject_id:"",question_text:"",a:"",b:"",c:"",d:"",correct_option:"0",explanation:"",exam_type:"UTME",exam_year:""});setAdminTab("question")}}>Add a question</button><button className="fp-secondary" onClick={()=>setAdminTab("import")}>Bulk import</button></div><article className="fp-admin-panel"><h2>Question library</h2>{adminQuestions.slice(0,150).map(q=><div className="fp-manage-row" key={q.id}><div><b>{q.question_text}</b><small>{subjectName(q.subject_id)} · {q.exam_type} · {q.published?"Published":"Draft"}</small></div><div><button onClick={()=>editAdminQuestion(q)}>Edit</button><button onClick={()=>toggleQuestion(q)}>{q.published?"Unpublish":"Publish"}</button><button className="danger" onClick={()=>deleteQuestion(q)}>Delete</button></div></div>)}{!adminQuestions.length&&<p className="fp-empty">No questions were returned. Check your admin permissions.</p>}</article></>}
      {adminTab==="content"&&<><div className="fp-admin-toolbar"><button className="fp-primary" onClick={()=>setAdminTab("note")}>Create study note</button><button className="fp-secondary" onClick={()=>setAdminTab("note")}>Add learning material</button></div><article className="fp-admin-panel"><h2>Study notes and learning content</h2>{adminNotes.map(n=><div className="fp-manage-row" key={n.id}><div><b>{n.title}</b><small>{subjectName(n.subject_id)} · {n.published?"Published":"Draft"} · {new Date(n.created_at).toLocaleDateString()}</small></div><div><button onClick={()=>toggleNote(n)}>{n.published?"Unpublish":"Publish"}</button><button className="danger" onClick={()=>deleteNote(n)}>Delete</button></div></div>)}{!adminNotes.length&&<p className="fp-empty">No study notes have been created yet.</p>}</article><article className="fp-admin-panel"><h2>Subject and topic coverage</h2>{subjects.map(s=><div className="fp-admin-row" key={s.id}><div><b>{s.name}</b><small>{topics.filter(t=>t.subject_id===s.id).length} topics · {notes.filter(n=>n.subject_id===s.id&&n.published).length} published notes</small></div></div>)}</article></>}
      {adminTab==="question"&&<form className="fp-admin-form" onSubmit={saveQuestion}><div className="fp-admin-panel-head"><h2>{editingQuestionId?"Edit question":"Publish a question"}</h2><button type="button" className="fp-secondary" onClick={()=>{setEditingQuestionId(null);setAdminTab("questions")}}>Back to question library</button></div><label>Subject<select required value={qForm.subject_id} onChange={e=>setQForm(v=>({...v,subject_id:e.target.value}))}><option value="">Choose subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Question<textarea required value={qForm.question_text} onChange={e=>setQForm(v=>({...v,question_text:e.target.value}))}/></label><div className="fp-form-grid">{(["a","b","c","d"] as const).map(k=><label key={k}>Option {k.toUpperCase()}<input required value={qForm[k]} onChange={e=>setQForm(v=>({...v,[k]:e.target.value}))}/></label>)}</div><label>Correct answer<select value={qForm.correct_option} onChange={e=>setQForm(v=>({...v,correct_option:e.target.value}))}>{[0,1,2,3].map(i=><option key={i} value={i}>{letter(i)}</option>)}</select></label><label>Explanation<textarea value={qForm.explanation} onChange={e=>setQForm(v=>({...v,explanation:e.target.value}))}/></label><div className="fp-form-grid"><label>Type<select value={qForm.exam_type} onChange={e=>setQForm(v=>({...v,exam_type:e.target.value}))}><option>UTME</option><option>POST_UTME</option><option>PRACTICE</option></select></label><label>Year<input type="number" min="1980" max="2026" value={qForm.exam_year} onChange={e=>setQForm(v=>({...v,exam_year:e.target.value}))}/></label></div><button className="fp-primary" disabled={busy}>{busy?"Saving…":editingQuestionId?"Save question":"Publish question"}</button></form>}
      {adminTab==="import"&&<form className="fp-admin-form" onSubmit={importQuestions}><h2>Bulk import questions</h2><p>Upload a .txt or .json file, or paste a batch below. Only import material you own or are authorised to use.</p><label>Subject<select required value={importSubjectId} onChange={e=>setImportSubjectId(e.target.value)}><option value="">Choose subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="fp-form-grid"><label>Default year<input type="number" min="1980" max="2026" value={importYear} onChange={e=>setImportYear(e.target.value)}/></label><label>Source label<input required value={importSource} onChange={e=>setImportSource(e.target.value)}/></label></div><label>Choose a question file (.txt or .json)<input type="file" accept=".txt,.json,text/plain,application/json" onChange={e=>loadImportFile(e.target.files?.[0])}/></label>{importFileName&&<small>Loaded: {importFileName}</small>}<label>Question batch<textarea required rows={16} value={importText} onChange={e=>setImportText(e.target.value)} placeholder={"Question: Which organelle controls cell activities?\nA: Nucleus\nB: Ribosome\nC: Vacuole\nD: Cell wall\nAnswer: A\nExplanation: The nucleus contains genetic material and controls cell activities.\n---\nQuestion: ..."}/></label><small>Separate each question with a line containing --- . Include Question:, A:, B:, C:, D:, Answer: A/B/C/D and optionally Year: and Explanation:.</small><button className="fp-primary" disabled={busy}>{busy?"Importing…":"Validate and publish batch"}</button></form>}
      {adminTab==="note"&&<form className="fp-admin-form" onSubmit={saveNote}><div className="fp-admin-panel-head"><h2>Publish study notes</h2><button type="button" className="fp-secondary" onClick={()=>setAdminTab("content")}>Back to content</button></div><label>Subject<select required value={nForm.subject_id} onChange={e=>setNForm(v=>({...v,subject_id:e.target.value}))}><option value="">Choose subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Title<input required value={nForm.title} onChange={e=>setNForm(v=>({...v,title:e.target.value}))}/></label><label>Summary<textarea value={nForm.summary} onChange={e=>setNForm(v=>({...v,summary:e.target.value}))}/></label><label>Full notes<textarea required rows={12} value={nForm.content} onChange={e=>setNForm(v=>({...v,content:e.target.value}))}/></label><button className="fp-primary" disabled={busy}>Publish notes</button></form>}
      <div className="fp-admin-refresh"><button className="fp-secondary" onClick={()=>refreshAdminData().catch(e=>setError(e.message))}>Refresh admin data</button><small>Data shown here is limited by the admin account's database permissions.</small></div>
    </>}</section>}
    <footer className="fp-footer">© 2026 FuturePath <span>Learn with purpose. Prepare with confidence.</span></footer>
   </div>
  </main>
 </div>
}
