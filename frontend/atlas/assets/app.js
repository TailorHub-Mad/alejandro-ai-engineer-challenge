"use strict";
const main=document.querySelector("#main"), sidebar=document.querySelector("#sidebar");
const menuToggle=document.querySelector("#menu-toggle");
const askHref=location.protocol!=="file:" && location.pathname.startsWith("/atlas/") ? "/" : "http://localhost:8080/";
document.querySelectorAll("#ask-link, [data-ask-link]").forEach(link=>link.setAttribute("href",askHref));
const assignmentLanding=document.querySelector("#assignment-landing").outerHTML;
const documentTitles={instructions:"Original instructions",criteria:"Completion checklist",sources:"Public source guidance"};
const assignmentDocuments=Object.fromEntries(Object.keys(documentTitles).map(key=>[key,document.getElementById("assignment/"+key).innerHTML]));
const traceNames=["Question","Embed","Compare","Retrieve","Assemble","Generate","Validate","Display"];
const refNav=[["reference","Glossary"],["code","Code reader"],["failures","Failure catalogue"],["quiz","Interview practice"]];
function navItem(url,label,icon,on){return '<a href="'+url+'" '+(on?'aria-current="page"':'')+'>'+glyph(icon)+'<span>'+esc(label)+'</span></a>';}
function side(r){
  const section=["brief","assignment","requirements"].includes(r[0])?"brief":["trace","results"].includes(r[0])?"results":["overview","lesson"].includes(r[0])?"overview":"reference";
  let h='<nav class="nav-group reading-nav" aria-label="Reading order"><div class="nav-caption">Reading order</div>';
  [["brief","The assignment"],["overview","The solution"],["results","The results"]].forEach(([id,label])=>{
    h+='<a href="#'+id+'" '+(section===id?'aria-current="location"':'')+'><span>'+label+'</span></a>';
  });
  h+='</nav><div class="nav-group"><div class="nav-caption">Explore in depth</div>';
  for(const [g,ids] of groups){
    const active=r[0]==="lesson"&&ids.includes(r[1]);
    h+='<details class="side-fold" '+(active?'open':'')+'><summary>'+esc(g)+'</summary>'+ids.map(id=>navItem(chapterURL(id),titles[id],id,r[0]==="lesson"&&r[1]===id)).join("")+'</details>';
  }
  h+='</div><div class="nav-group"><div class="nav-caption">Reference</div>'+refNav.map(([id,l])=>navItem("#"+id,l,id==="reference"?"glossary":id,r[0]===id)).join("")+'</div>';
  sidebar.innerHTML=h;
  for(const a of document.querySelectorAll(".topnav a")) {
    const selected=a.hash==="#"+section;
    if(selected)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");
  }
}
function overview(){
  const c=caseList[S.case];
  return '<div class="overview-title"><div class="eyeline"><i class="rule"></i> Prototype</div><h1>The solution</h1><p>We chose three pages of an Australian vessel-inspection manual. The backend turns six inspection steps into searchable passages, picks the '+D.config.topK+' closest to a question and asks the model to answer from them.</p></div>'+
  '<div class="hero-grid"><section class="blue-card"><header><div><span class="blue-label">System schematic</span><h2>From document to evidence</h2></div><span class="plate-mark" aria-hidden="true">⌖</span></header>'+diagramSVG()+'<div class="blue-actions"><a href="#lesson/pdf">Inspect source</a><a href="#lesson/retrieval">Explore retrieval</a><a href="#lesson/validation">Check citations</a></div></section>'+
  '<section class="trace-card"><div class="eyeline"><i class="trace-symbol" aria-hidden="true">⌁</i> Earlier k = '+D.results.top_k+' run</div><h2>Replay an archived question</h2><div class="case-switch">'+button("case","Location",0,S.case===0)+button("case","Weight",1,S.case===1)+'</div><blockquote>“'+esc(c.question)+'”</blockquote><a class="primary" href="#trace/'+S.case+'/0">Open trace lab</a></section></div>'+
  '<div class="facts">'+[["3","Source pages","scope"],["6","Indexed passages","chunks"],["256","Vector dimensions","embeddings"],[D.config.topK,"Retrieved per query","retrieval"]].map(([n,l,id])=>'<a href="'+chapterURL(id)+'"><strong>'+n+'</strong><span>'+l+'</span></a>').join("")+'</div>'+
  '<a class="read-next" href="#results"><span><small>Continue to the results</small><strong>What do the recorded runs show?</strong></span><b aria-hidden="true">→</b></a><div class="section-title"><h2>Explore the implementation</h2><span>12 interactive chapters</span></div><div class="path-list">'+groups.map(([title,ids],i)=>'<section class="path"><div class="path-icon">'+glyph(["pdf","retrieval","evaluation"][i])+'</div><div><h3>'+esc(title)+'</h3><p>'+["Trace the original table geometry into a searchable index.","Inspect each request, score, passage and citation.","Review recorded outputs, cost and what a pilot would need."][i]+'</p><div class="path-links">'+ids.map(id=>chapterLink(id)).join("")+'</div></div></section>').join("")+'</div>'+details("What was verified?",'<p>'+esc(D.results.method)+'</p><p>The interactive labs use the archived whole-step vectors and two saved responses. The Ask screen calls the current backend, verifies exact quotes and records each answer trace.</p>')+sourceCredit();
}
function originalDocument(key){
  if(!Object.hasOwn(assignmentDocuments,key))key="instructions";
  const links=Object.entries(documentTitles).map(([id,title])=>'<a href="#assignment/'+id+'" '+(key===id?'aria-current="page"':'')+'>'+title+'</a>').join("");
  return '<div class="crumb"><a href="#brief">The assignment</a><span>/</span>Original documents</div><nav class="ref-tabs doc-tabs" aria-label="Original documents">'+links+'</nav><article class="original-doc">'+assignmentDocuments[key]+'</article><a class="read-next" href="#overview"><span><small>Continue to the solution</small><strong>See how the brief was implemented</strong></span><b aria-hidden="true">→</b></a>';
}
function resultsPage(){
  const cases=caseList.map((c,i)=>{
    const quotes=c.displayed_claims.map(cl=>'<p>'+esc(cl.text)+'</p>').join("");
    const evidence=c.retrieved.map(hit=>{const row=chunk(hit.id);return 'Step '+row.step+' · p. '+row.page;}).join(' / ');
    return '<article class="run-result '+(i?'gap':'')+'"><div class="eyeline">'+(i?'Evidence gap':'Partial answer')+'</div><h2>'+esc(c.question)+'</h2><div class="output-quote"><span>Displayed answer</span>'+quotes+'</div><p class="run-evidence">'+esc(evidence)+'</p><p>'+esc(c.judgement)+'</p><a class="textlink" href="#trace/'+i+'/0">Trace this run →</a></article>';
  }).join("");
  const live=D.liveResults;
  const current=live?'<h2>Latest live evaluation · k = '+esc(live.top_k)+'</h2><div class="result-pair">'+live.cases.map(c=>'<article class="run-result"><h2>'+esc(c.question)+'</h2><div class="output-quote"><span>'+esc(c.status)+'</span>'+c.claims.map(cl=>'<p>'+esc(cl.text)+'</p>').join("")+'</div><p>Cited steps: '+esc(c.cited_steps.join(", ")||"none")+'</p><p>'+esc(c.review_note)+'</p></article>').join("")+'</div>':box("Current configuration · k = "+D.config.topK,"The snapshot has no completed live evaluation for this configuration. The earlier answers below used fewer passages.");
  return lessonHeader("Verification","The results","Compare what the model retrieved, what it cited and what its answer actually covered.")+current+'<h2>Archived evaluation · k = '+D.results.top_k+'</h2><div class="result-pair">'+cases+'</div>'+details("How the archived runs were verified",'<p>'+esc(D.results.method)+'</p>')+'<a class="read-next" href="#lesson/pilot"><span><small>Prepare for the interview</small><strong>Which improvement comes first?</strong></span><b aria-hidden="true">→</b></a>';
}
function lessonPage(id){
  const idx=lessons.findIndex(l=>l.id===id), l=lessons[idx];
  if(!l)return overview();
  const group=groups.find(g=>g[1].includes(id))[0];
  return lessonHeader(group,l.title,l.summary)+labs[id]()+'<section class="explanation"><h2>How this part works</h2><p class="principle">'+esc(l.principle)+'</p>'+l.mechanics.map((m,i)=>details(m.title,'<p>'+esc(m.body)+'</p>',i===0)).join("")+'</section><div class="two notes">'+box("Common mistake",l.pitfall,"amber")+box("Check your understanding",l.check)+'</div><div class="code-jump">'+jump(l.code.file,l.code.symbol)+'</div><nav class="lesson-pager" aria-label="Adjacent chapters">'+(idx>0?'<a href="'+chapterURL(lessons[idx-1].id)+'"><small>Previous chapter</small>'+esc(titles[lessons[idx-1].id])+'</a>':'<a href="#overview"><small>Back to</small>System overview</a>')+(idx+1<lessons.length?'<a href="'+chapterURL(lessons[idx+1].id)+'"><small>Next chapter</small>'+esc(titles[lessons[idx+1].id])+'</a>':'<a href="#quiz"><small>Practise</small>Interview questions</a>')+'</nav>';
}
function traceBody(i){
  const c=caseList[S.case], cfg=D.config, chosen=c.retrieved.map(r=>chunk(r.id)), uid=D.queryVectors[S.case];
  const stages=[
    ["Receive the question","The frontend trims the text and submits a single JSON field. The API rejects a blank question or values over 1,200 characters.",pre({method:"POST",path:"/api/ask",body:{question:c.question}}),"request"],
    ["Turn text into a direction","The same OpenAI embedding model represents both documents and queries in a 256-dimensional space. This is the beginning of the real query vector.",pre({model:cfg.embeddingModel,dimensions:256,first_eight:uid.slice(0,8).map(x=>Number(x.toFixed(7)))})+box("Next operation","Normalise the query before taking its dot product with each stored unit vector."),"embeddings"],
    ["Score every passage","All six passages compete. Stable descending order preserves the original order for exact ties. These scores are rounded only for display.",rankRows(chosen.length,-1,false),"retrieval"],
    ["Keep the top "+chosen.length,"These steps entered this recorded request. Open each to inspect the exact wording.",chosen.map(a=>details(passageHeader(a),fullPassage(a),true)).join(""),"retrieval"],
    ["Construct the messages","The system message gives evidence rules. The user message contains the question and a JSON object for each selected passage.",details("Recorded user payload",pre(userPayload(c.retrieved)),true),"prompt"],
    ["Read the model response","This is what GPT-4.1 mini actually returned in the recorded run, before backend checks.",pre(c.provider_response),"prompt"],
    ["Check status and citations","Every cited ID must belong to the retrieved set. An empty evidence gap receives a standard explanation. This recording used passage IDs. The current backend also checks an exact quoted substring and the reader can inspect its highlighted lines.",pre({allowed_ids:chosen.map(x=>x.id),status:c.provider_response.status,claims_after_validation:c.displayed_claims}),"validation"],
    ["Show the decision and evidence","The reader sees the checked claims and can expand their source passages. An evidence gap still has nearby retrieved material to inspect.",answerCard(),"interface"]
  ];
  const [title,desc,content,link]=stages[i];
  return '<div class="trace-stage"><div class="eyeline">Stage '+(i+1)+' of '+stages.length+'</div><h2>'+esc(title)+'</h2><p>'+esc(desc)+'</p>'+content+chapterLink(link,"Open the full chapter")+'</div>';
}
function tracePage(r){
  if(r[1]!==undefined)S.case=r[1]==="1"?1:0;
  if(r[2]!==undefined)S.traceAt=Math.max(0,Math.min(7,Number(r[2])||0));
  S.display="case";
  return lessonHeader("Trace lab","Follow one question","Replay the original ID-only answers at k = "+D.results.top_k+". The current backend uses k = "+D.config.topK+".")+'<div class="trace-controls">'+caseSelect()+'<span class="tag">Recorded replay</span></div>'+observedQuestion()+'<nav class="timeline" aria-label="Trace stages">'+traceNames.map((s,i)=>'<a href="#trace/'+S.case+'/'+i+'" '+(i===S.traceAt?'aria-current="step"':'')+'><span>'+String(i+1).padStart(2,"0")+'</span>'+esc(s)+'</a>').join("")+'</nav>'+traceBody(S.traceAt)+'<div class="trace-footer">'+(S.traceAt?'<a class="secondary" href="#trace/'+S.case+'/'+(S.traceAt-1)+'">Previous stage</a>':'<span></span>')+(S.traceAt<7?'<a class="primary" href="#trace/'+S.case+'/'+(S.traceAt+1)+'">Next stage</a>':'<a class="primary" href="#trace/'+(1-S.case)+'/0">Trace the other question</a>')+'</div>';
}
function referenceBar(id){
  return '<nav class="ref-tabs" aria-label="References">'+refNav.map(([link,label])=>'<a href="#'+link+'" '+(id===link?'aria-current="page"':'')+'>'+esc(label)+'</a>').join("")+'</nav>';
}
function glossaryList(term=""){
  const str=term.toLowerCase();
  const list=ref.glossary.filter(g=>(g.term+" "+g.definition+" "+g.example).toLowerCase().includes(str));
  return (list.length?list.map(g=>details(g.term,'<p>'+esc(g.definition)+'</p><p><strong>In this PoC.</strong> '+esc(g.example)+'</p>'+chapterLink(g.lesson),term!=="" && list.length<=3)).join(""):box("No matches","Try a shorter term or search across the whole atlas."));
}
function glossaryPage(r){
  if(r[1])S.glossary=r[1];
  return lessonHeader("Reference desk","Glossary","Look up a term, see how the PoC uses it, then open the relevant chapter.")+referenceBar("reference")+'<label class="field wide"><span>Filter '+ref.glossary.length+' terms</span><input id="glossary-input" type="search" value="'+esc(S.glossary)+'" placeholder="Search terms and examples"></label><div class="dictionary" id="glossary-list">'+glossaryList(S.glossary)+'</div>';
}
function codeLine(lines,symbol){
  if(!symbol)return -1;
  const names=[symbol,...symbol.split(/\s+and\s+|,\s*|\.|\s+\/\s+/)].filter(Boolean);
  for(const name of names){
    const n=name.replace(/\(\)$/,"");
    const found=lines.findIndex(l=>l.includes("def "+n+"(")||l.includes("class "+n)||l.includes("function "+n+"(")||l.trimStart().startsWith(n+" =")||l.trimStart().startsWith("const "+n+" "));
    if(found>=0)return found;
  }
  for(const n of names){const i=lines.findIndex(l=>l.includes(n));if(i>=0)return i;}
  return -1;
}
function codePage(r){
  const file=r[1]||"backend/answer.py", symbol=r[2]||"";
  const ann=ref.files[file]||[], lines=(D.files[file]||"").split(/\r?\n/), mark=codeLine(lines,symbol);
  const files=[...new Set([...Object.keys(D.files),...Object.keys(ref.files)])];
  const code='<div class="source-code" role="region" aria-label="Source code with line numbers" tabindex="0">'+lines.map((l,i)=>'<div class="code-line '+(i===mark?'highlight':'')+'" '+(i===mark?'id="code-highlight"':'')+'><span>'+String(i+1).padStart(2,"0")+'</span><code>'+esc(l||" ")+'</code></div>').join("")+'</div>';
  return lessonHeader("Reference desk","Read the implementation","Inspect the source captured with this atlas and connect its symbols to the behaviour you observed.")+referenceBar("code")+select("Repository file","codeFile",files.map(f=>[f,f]),file)+'<div class="section-title"><h2 class="file-title">'+esc(file)+'</h2>'+tag(D.files[file]?"Source snapshot":"File guide")+'</div>'+
  (ann.length?'<div class="symbol-list">'+ann.map(a=>'<a class="'+(symbol===a.symbol?'on':'')+'" href="'+codeURL(file,a.symbol)+'">'+esc(a.symbol)+'</a>').join("")+'</div>':'')+
  (symbol?box(symbol,(ann.find(a=>a.symbol===symbol)||{}).explanation||(mark>=0?"The matching definition is highlighted below.":"Consult the file or its symbol guide below.")):'')+
  (D.files[file]?code:'<p class="fine">This entry describes the generated store or the original assignment. Its full file is available in the local repository.</p>')+
  (ann.length?details("All symbol explanations",ann.map(a=>'<h4>'+esc(a.symbol)+'</h4><p>'+esc(a.explanation)+'</p>').join("")):'');
}
function failurePage(r){
  const f=ref.failures.find(x=>x.id===r[1])||ref.failures[0];
  return lessonHeader("Reference desk","Diagnose a failure","Start with an observed symptom, locate the failing layer and decide what to check first.")+referenceBar("failures")+select("Scenario","failure",ref.failures.map(x=>[x.id,x.label]),f.id)+panel(f.label,f.layer,box("What triggers it",f.trigger)+box("Where it surfaces",f.route,"amber")+box("What the user sees",f.visible)+box("Cause",f.cause)+box("First check",f.check));
}
function quizPage(){
  const q=ref.quiz[S.quizIndex], n=S.quizIndex, has=Object.hasOwn(S.quizAnswers,n), a=S.quizAnswers[n];
  const total=Object.keys(S.quizAnswers).length, right=Object.entries(S.quizAnswers).filter(([i,x])=>x===ref.quiz[i].answer).length;
  return lessonHeader("Reference desk","Interview practice","Predict what happens before revealing the reasoning. Your answers stay in this browser tab.")+referenceBar("quiz")+'<div class="toolbar">'+select("Question","quizIndex",ref.quiz.map((q,i)=>[i,(i+1)+". "+q.question]),n)+'</div>'+panel(q.question,"Question "+(n+1)+" of "+ref.quiz.length,'<div class="answers">'+q.choices.map((c,i)=>'<button type="button" data-cmd="quizAnswer" data-value="'+i+'" class="'+(has&&i===q.answer?'correct ':has&&i===a?'wrong ':'')+'"><b>'+String.fromCharCode(65+i)+'</b>'+esc(c)+'</button>').join("")+'</div>'+(has?box(a===q.answer?"Correct":"Review the reasoning",q.explanation,a===q.answer?"":"amber")+chapterLink(q.lesson):'')+'<div class="trace-footer"><span>'+right+' correct · '+total+' answered</span>'+button("quizNext",n===ref.quiz.length-1?"First question":"Next question")+'</div>');
}
function requirementsPage(){
  const ac=[["R1 · Sources","One reviewed English document, short coherent excerpt, extraction code, location metadata, attribution and reuse basis.","pdf"],["R2 · Live AI flow","A browser question reaches the backend, which embeds it, searches a persisted index and passes a bounded set of passages to a remote LLM.","request"],["R3 · Evidence","Each factual claim has an exact quote that opens at its highlighted lines on the source page.","validation"],["R4 · Evidence gap","A plausible missing quantity is identified without inventing a number.","interface"],["R5 · Errors","Finite model-call timeouts and distinct technical errors appear in the web UI.","request"],["R6 · Verification","Two recorded examples have expectations, retrieved IDs, outputs and reasoned judgements.","evaluation"],["R7 · Reproduction","One backend key, local application and diagnostics, repeatable setup, and estimated cost.","index"],["R8 · Ownership","Decisions, limitations, three ordered next steps, time spent and checks on AI-assisted work.","pilot"]];
  return lessonHeader("The assignment","Requirements mapped to code","Open a requirement to see the corresponding chapter and implementation.")+'<a class="textlink" href="#assignment/criteria">Read the original completion checklist →</a>'+ac.map(([l,d,id])=>details(l,'<p>'+d+'</p>'+chapterLink(id))).join("")+box("Interview walkthrough","The brief sets a 3–4 hour target and a 5-hour maximum for the PoC. In the 60-minute review, spend roughly three minutes on the web flow, three on choices and limitations, and four on next steps.")+details("Run the local assistant",pre("Copy .env.example to .env and configure one backend provider and key.\ndocker compose up --build -d\n# Open http://localhost:8080/\ndocker compose exec assistant python -m eval.run")+'<p>Docker prepares Python and the index. The offline atlas can be read without a provider key.</p>');
}
function render(scroll=false){
  const r=route();
  const renders={brief:()=>assignmentLanding,assignment:()=>originalDocument(r[1]),requirements:requirementsPage,overview,results:resultsPage,lesson:()=>lessonPage(r[1]),trace:()=>tracePage(r),reference:()=>glossaryPage(r),code:()=>codePage(r),failures:()=>failurePage(r),quiz:quizPage};
  if(!Object.hasOwn(renders,r[0]))r[0]="brief";
  if(!document.body.dataset.route || scroll)side(r);
  document.body.dataset.route=r[0];
  main.innerHTML=renders[r[0]]();
  document.title=(main.querySelector("h1")?.textContent||"Assignment")+" · Case study";
  if(scroll){window.scrollTo(0,0);setMenuOpen(false);main.focus({preventScroll:true});}
  if(r[0]==="code"&&r[2]){const line=main.querySelector("#code-highlight");if(line){line.parentElement.scrollTop=Math.max(0,line.offsetTop-80);}}
}
function setValue(key,raw){
  if(key==="codeFile"){location.hash=codeURL(raw);return;}
  if(key==="failure"){location.hash="#failures/"+slug(raw);return;}
  if(["case","step","row","dim","k","compare","build","cost","pilot","scopePage","quizIndex"].includes(key))S[key]=Number(raw);
  else if(["vector","provider","field","promptTab","display"].includes(key))S[key]=raw;
  if(key==="step")S.row=0;
  if(key==="build"&&S.build!==2)S.stop=false;
  if(key==="case"){S.validateDraft=null;S.validationOutput=null;if(route()[0]==="trace"){location.hash="#trace/"+S.case+"/"+S.traceAt;return;}}
  const active=document.activeElement, restore=active&&main.contains(active)?{cmd:active.dataset.cmd,v:active.dataset.value,setting:active.dataset.setting}:null;
  const openDetails=[...main.querySelectorAll("details[open]")].map(d=>d.querySelector("summary")?.textContent);
  render();
  if(restore){const next=[...main.querySelectorAll("button, select, input")].find(el=>(restore.setting&&el.dataset.setting===restore.setting)||(restore.cmd&&el.dataset.cmd===restore.cmd&&el.dataset.value===restore.v));next?.focus({preventScroll:true});}
  if(key==="dim")for(const d of main.querySelectorAll("details"))if(openDetails.includes(d.querySelector("summary")?.textContent))d.open=true;
}
main.addEventListener("change",e=>{if(e.target.dataset.setting)setValue(e.target.dataset.setting,e.target.value);});
main.addEventListener("input",e=>{
  const el=e.target;
  if(el.type==="range"){el.closest("label").querySelector("output").textContent=el.value;}
  if(el.id==="glossary-input"){S.glossary=el.value;document.querySelector("#glossary-list").innerHTML=glossaryList(el.value);}
  if(el.id==="request-draft"){S.request=el.value;document.querySelector("#char-count").textContent=Array.from(S.request).length+" / 1,200 characters";document.querySelector("#request-json").textContent=JSON.stringify({question:S.request},null,2);document.querySelector("#request-check").innerHTML=requestInfo();}
  if(el.id==="validation-draft"){S.validateDraft=el.value;S.validationOutput=null;const out=el.closest(".instrument-body").querySelector(".note");if(out)out.remove();}
});
main.addEventListener("keydown",e=>{
  if(!e.target.matches(".heatcell"))return;
  const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-16,ArrowDown:16}[e.key];
  if(offset===undefined)return;
  e.preventDefault();
  setValue("dim",Math.max(1,Math.min(256,S.dim+offset)));
  main.querySelector(".heatcell.picked")?.focus({preventScroll:true});
});
main.addEventListener("click",e=>{
  const b=e.target.closest("[data-cmd]");if(!b)return;
  const cmd=b.dataset.cmd,raw=b.dataset.value;
  if(cmd==="evidence"){e.preventDefault();const d=document.getElementById("evidence-"+raw);if(d){d.open=true;d.scrollIntoView({block:"nearest"});}return;}
  if(cmd==="magnify")S.magnify=!S.magnify;
  if(cmd==="stop"){S.stop=!S.stop;if(S.stop)S.build=2;}
  if(cmd==="preset"){S.validateDraft=JSON.stringify(preset(raw),null,2);S.validationOutput=null;}
  if(cmd==="validate")S.validationOutput=verifyDraft(S.validateDraft);
  if(cmd==="quizAnswer")S.quizAnswers[S.quizIndex]=Number(raw);
  if(cmd==="quizNext")S.quizIndex=(S.quizIndex+1)%ref.quiz.length;
  setValue(cmd,raw);
});
const dialog=document.querySelector("#search-dialog"), finder=document.querySelector("#search-input");
const searchItems=[
  ["The original assignment","Assignment","Take-home task instructions, time limit, budget and interview","#assignment/instructions"],
  ["Completion checklist","Assignment","Acceptance criteria and requirements","#assignment/criteria"],
  ["Public source guidance","Assignment","Original publisher and source choices","#assignment/sources"],
  ["The results","Verification","See the supported answer and the evidence gap","#results"],
  ["Requirement map","Assignment","Explore each requirement and the implementing chapter","#requirements"],
  ...lessons.map(l=>[titles[l.id],"Chapter",l.title+" "+l.summary,chapterURL(l.id)]),
  ...ref.glossary.map(g=>[g.term,"Term",g.definition,"#reference/"+slug(g.term)]),
  ...Object.entries(ref.files).flatMap(([f,s])=>[[f,"File","Code reader",codeURL(f)],...s.map(a=>[a.symbol,"Symbol",f+" "+a.explanation,codeURL(f,a.symbol)])]),
  ...ref.failures.map(f=>[f.label,"Scenario",f.trigger,"#failures/"+slug(f.id)]),
  ["Question trace","Lab","Replay two real questions with 8 stages","#trace"],["Assignment","Reference","Rubric, requirements, costs and walkthrough","#brief"],["Interview practice","Reference","Quiz and rehearse the defence","#quiz"]
];
function doSearch(){
  const q=finder.value.toLowerCase().trim();
  const hits=q?searchItems.filter(it=>(it[0]+" "+it[2]).toLowerCase().includes(q)).sort((a,b)=>Number(b[0].toLowerCase().includes(q))-Number(a[0].toLowerCase().includes(q))):searchItems.slice(0,5);
  document.querySelector("#search-results").innerHTML=hits.slice(0,45).map(([l,t,d,url])=>'<a href="'+url+'"><span>'+esc(l)+'</span><small>'+t+'</small></a>').join("")||'<p>No matching chapter, symbol or term.</p>';
}
function setMenuOpen(open){
  document.body.classList.toggle("menu-open",open);
  menuToggle.setAttribute("aria-expanded",String(open));
}
function openSearch(){setMenuOpen(false);finder.value="";doSearch();dialog.showModal();finder.focus();}
document.querySelector("#open-search").addEventListener("click",openSearch);
document.querySelector("#close-search").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",e=>{if(e.target.closest("a")||e.target===dialog)dialog.close();});
finder.addEventListener("input",doSearch);
document.addEventListener("keydown",e=>{if(e.key==="/"&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)&&!dialog.open){e.preventDefault();openSearch();}if(e.key==="Escape"&&document.body.classList.contains("menu-open")){setMenuOpen(false);menuToggle.focus();}});
menuToggle.addEventListener("click",()=>{
  const open=menuToggle.getAttribute("aria-expanded")!=="true";
  setMenuOpen(open);
  if(open)(sidebar.querySelector('[aria-current="page"]')||sidebar.querySelector('[aria-current]')||sidebar.querySelector("a"))?.focus();
});
document.addEventListener("click",event=>{
  if(!document.body.classList.contains("menu-open")||menuToggle.contains(event.target))return;
  const link=event.target.closest("a");
  if(sidebar.contains(event.target)&&!link)return;
  setMenuOpen(false);
  if(link?.hash===location.hash)main.focus({preventScroll:true});
});
document.querySelector(".skip").addEventListener("click",e=>{e.preventDefault();main.focus();});
window.addEventListener("hashchange",()=>render(true));
render();

