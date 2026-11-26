"use strict";
function scopeLab() {
  const inScope=S.scopePage>=20 && S.scopePage<=22;
  const pages=Array.from({length:52},(_,i)=>'<button data-cmd="scopePage" data-value="'+(i+1)+'" class="'+(i+1>=20&&i+1<=22?'included ':'')+(S.scopePage===i+1?'selected':'')+'" aria-label="Page '+(i+1)+(i+1>=20&&i+1<=22?', indexed':', outside selection')+'" aria-pressed="'+(S.scopePage===i+1)+'">'+(i+1)+'</button>').join("");
  return panel("Which pages can become evidence?", "Source selector", '<div class="flexkey"><span><i class="sw teal"></i> Indexed</span><span><i class="sw gray"></i> Outside the collection</span></div><div class="page-grid">'+pages+'</div>'+box("Page "+S.scopePage,inScope?"Indexed in section 8.1. This page supplies step"+(S.scopePage===21?" 3.":S.scopePage===20?"s 1 and 2.":"s 4, 5 and 6."):"Available in the original 52-page manual. The prototype excludes this page from extraction, so its content cannot be retrieved.")+details("Edition, fingerprint and reuse",'<p>'+esc(D.source.edition)+' · '+esc(D.source.publicationDate)+'</p>'+pre(D.source.sha256)+'<p>A SHA-256 digest identifies the reviewed file byte for byte. A changed download stops the build until it has been reviewed.</p>'+sourceCredit()));
}
function sourceCredit() {
  return '<p class="credit">'+esc(D.source.attribution)+' '+esc(D.source.adaptations)+' <a href="'+esc(D.source.url)+'" target="_blank" rel="noopener">Original PDF</a> · <a href="'+esc(D.source.licenseUrl)+'" target="_blank" rel="noopener">CC BY 4.0</a></p>';
}
function pdfLab() {
  const c=byStep(S.step), page=D.pages.find(p=>p.page===c.page), s=page.steps.find(p=>p.step===S.step);
  const row=s.decisions[Math.min(S.row, s.decisions.length-1)], rect=row?row.box:s.box;
  const overlays=page.steps.map(p=>rectButton(p.box,p.step,p.step===S.step)).join("");
  let body='<div class="toolbar">'+chunkSelect()+(s.decisions.length?select("Conditional row","row",s.decisions.map((d,i)=>[i,d.condition]),S.row):'')+button("magnify",S.magnify?"Show page":"Magnify selection","",S.magnify)+'</div>';
  if(S.magnify){
    const pad=.013, x=Math.max(0,rect[0]-pad), y=Math.max(0,rect[1]-pad),
      w=Math.min(1-x,rect[2]+2*pad), h=Math.min(1-y,rect[3]+2*pad);
    body+='<div class="crop-view" style="aspect-ratio:'+(w*page.width)+' / '+(h*page.height)+'"><img alt="Magnified selection on original page '+page.page+'" src="'+page.image+'" style="width:'+(100/w)+'%;left:'+(-100*x/w)+'%;top:'+(-100*y/h)+'%"></div>';
  }else{
    body+='<div class="scan"><img alt="DAFF work instruction page '+page.page+', procedure table" src="'+page.image+'">'+overlays+(row?'<span class="rowbox" style="'+boxStyle(rect)+'"></span>':'')+'</div>';
  }
  body+='<div class="scan-legend"><span><i class="sw teal"></i> Selected step</span><span><i class="sw gold"></i> Selected decision row</span></div>';
  body+=row?'<div class="two"><div class="readout"><small>If</small><p>'+esc(row.condition)+'</p></div><div class="readout"><small>Then</small><p>'+esc(row.action)+'</p></div></div>':box("Single action",c.text);
  return panel("Source microscope","Original page "+c.page,body+sourceCredit());
}
function boxStyle(b){return 'left:'+b[0]*100+'%;top:'+b[1]*100+'%;width:'+b[2]*100+'%;height:'+b[3]*100+'%';}
function rectButton(b,step,on){return '<button type="button" data-cmd="step" data-value="'+step+'" aria-label="Inspect step '+step+'" aria-pressed="'+on+'" class="stepbox '+(on?'selected':'')+'" style="'+boxStyle(b)+'"></button>';}
function chunkLab(){
  const c=byStep(S.step);
  const fields={text:fullPassage(c),record:pre(c),embed:pre("Inspecting the inside of an empty vessel hold. Step "+c.step+". "+c.text.replace(/\s+/g," "))};
  return panel("Dissect a stored passage","6 addressable steps", '<div class="toolbar">'+chunkSelect()+'</div><div class="seg">'+[["text","Readable text"],["record","JSON record"],["embed","Archived embedding input"]].map(([v,label])=>button("field",label,v,v===S.field)).join("")+'</div>'+fields[S.field]+box("What survives the split?","The ID, source, page, section and step survive as metadata. The archived embedding used the full step shown here. The current search input uses the procedure before its If/Then table. Generation still receives the complete passage.")+chapterLink("pdf","Inspect the original table"));
}
function vectorLab(){
  const pairs=[...D.chunks.map((c,i)=>["c"+i,c.id]),["q0","Question · location"],["q1","Question · weight"]];
  const isQuery=S.vector[0]==="q", i=Number(S.vector.slice(1)), vec=(isQuery?D.queryVectors:D.vectors)[i];
  const max=Math.max(...vec.map(Math.abs)), n=S.dim-1;
  const cells=vec.map((val,j)=>'<button class="heatcell '+(j===n?'picked':'')+'" style="--v:'+Math.floor(19+71*Math.abs(val)/max)+'%;--h:'+(val>=0?'185':'37')+'" tabindex="'+(j===n?0:-1)+'" data-cmd="dim" data-value="'+(j+1)+'" aria-label="Component '+(j+1)+', '+fmt(val,6)+'" aria-pressed="'+(j===n)+'"></button>').join("");
  return panel("Open an embedding","Archived whole-step index",'<div class="toolbar">'+select("Vector","vector",pairs,S.vector)+'</div><div class="heat-layout"><div class="heatmap" aria-label="16 by 16 component grid in row-major order">'+cells+'</div><div class="heat-read"><span class="eyeline">Selected component</span><div class="bigmono">'+String(S.dim).padStart(3,"0")+'</div><b class="decimal">'+fmt(vec[n],7)+'</b>'+range("Coordinate","dim",S.dim,1,256)+'<p>Cells run left to right. Colour identifies the sign. Stronger colour means a larger absolute value within this vector.</p><div class="flexkey"><span><i class="sw teal"></i> Positive</span><span><i class="sw gold"></i> Negative</span></div></div></div>'+box("Vector length",Math.hypot(...vec).toFixed(7)+" across all 256 components. Directions can be compared across passages and questions in this same model space. Individual coordinates have no assigned maritime labels.")+details("Text submitted for this vector",pre(isQuery?caseList[i].question:"Inspecting the inside of an empty vessel hold. Step "+D.chunks[i].step+". "+D.chunks[i].text.replace(/\s+/g," "))));
}
const buildSteps=[
  ["Extract six steps","Raw PDF on disk","The edition digest and table geometry must pass before any model request."],
  ["Embed the batch","Six vectors in memory","The provider returns one indexed row per input. The client restores order and checks each position."],
  ["Write the temporary file","Old index still available","Text, metadata and normalised vectors are written to a new file in the same directory."],
  ["Replace the stored index","New version on disk","os.replace publishes the complete new index. The temporary file is removed in finally."],
  ["Reload the server","New version in memory","The one-entry cache lasts for the process. Restarting clears it. The next question loads the replacement."]
];
function indexLab(){
  const b=buildSteps[S.build], stalled=S.stop && S.build===2;
  return panel("Observe an index rebuild","Local simulation",'<div class="toolbar">'+select("Build milestone","build",buildSteps.map((b,i)=>[i,b[0]]),S.build)+button("stop","Interrupt temporary write","",S.stop)+'</div><div class="build-track">'+buildSteps.map((b,i)=>'<button data-cmd="build" data-value="'+i+'" class="'+(S.build===i?'on':'')+'"><strong>'+b[0]+'</strong></button>').join("")+'</div><div class="readout"><small>'+esc(stalled?"Write interrupted":b[1])+'</small><h3>'+esc(b[0])+'</h3><p>'+esc(stalled?"An exception skips the replacement. The existing complete index remains on disk and the temporary file is cleaned up.":b[2])+'</p></div>'+ (S.stop&&S.build!==2?'<p class="fine">Select “Write the temporary file” to see the interruption.</p>':'')+details("Inspect a stored row and the file header",pre({edition:D.source.edition,embedding_model:D.config.embeddingModel,dimensions:256,chunks:[D.chunks[5]],vectors:["6 rows × 256 float values; one row per chunk"]})));
}
function requestInfo(){
  const n=Array.from(S.request).length, ok=n>0&&n<=1200&&!!S.request.trim();
  return box(ok?"Passes local input validation":"HTTP 422 · invalid question",ok?"The API trims outer whitespace and sends the remaining English question for embedding. This simulator stops before inference.":n>1200?"The submitted value exceeds the 1,200-character request limit.":"An empty or whitespace-only question cannot enter retrieval.",ok?"":"amber");
}
function requestLab(){
  const p=D.config.providers[S.provider];
  return panel("Build a question request","Local simulation",'<div class="toolbar">'+select("Backend provider","provider",Object.keys(D.config.providers).map(k=>[k,k]),S.provider)+'</div><label class="field wide"><span>Question sent to POST /api/ask</span><textarea id="request-draft" rows="3">'+esc(S.request)+'</textarea></label><p id="char-count" class="fine">'+Array.from(S.request).length+' / 1,200 characters</p><div id="request-check">'+requestInfo()+'</div><div class="two"><div><h3>Browser payload</h3><pre class="code-block" id="request-json">'+esc(JSON.stringify({question:S.request},null,2))+'</pre></div><div><h3>Backend configuration</h3>'+pre({base_url:p.url,key_variable:p.keyVariable,embedding_model:p.prefix+D.config.embeddingModel,chat_model:p.prefix+D.config.chatModel})+'</div></div>');
}
function rankRows(k,selected,interactive=true){
  const ranks=D.rankings[S.case];
  return '<div class="rank-list">'+ranks.map((r,i)=>{
    const c=chunk(r.id);let inner='<span class="rank-name">Step '+c.step+'</span><span class="bar-wrap"><i style="width:'+Math.max(0,r.score)*100+'%"></i></span><span class="score">'+fmt(r.score)+'</span><span class="kept">'+(i<k?'Selected':'Omitted')+'</span>';
    return interactive?'<button data-cmd="compare" data-value="'+(c.step-1)+'" aria-pressed="'+(selected===c.step-1)+'" class="rank '+(i<k?'in ':'')+(selected===c.step-1?'current':'')+'">'+inner+'</button>':'<div class="rank '+(i<k?'in':'')+'">'+inner+'</div>';
  }).join("")+'</div>';
}
function angleView(score,step){
  const theta=Math.acos(Math.max(-1,Math.min(1,score)));
  const x=48+135*Math.cos(theta), y=166-135*Math.sin(theta);
  return '<figure class="angleview"><svg viewBox="0 0 252 198" role="img" aria-label="Angle between the two normalised vectors"><path d="M 48 31 A 135 135 0 0 1 183 166" fill="none" stroke="#476572" stroke-dasharray="3 5"/><path d="M48 166 H220" stroke="#6ed8c5" stroke-width="3"/><path d="M48 166 L'+x+' '+y+'" stroke="#f5bd72" stroke-width="3"/><path d="M'+x+' '+y+' V166" stroke="#d5e1df" stroke-dasharray="4 4"/><circle cx="'+x+'" cy="'+y+'" r="5" fill="#f5bd72"/><circle cx="183" cy="166" r="5" fill="#6ed8c5"/><g fill="#e7f2ec" font-family="monospace" font-size="11"><text x="146" y="186">Question</text><text x="'+(x+8)+'" y="'+(y+3)+'">Step '+step+'</text></g></svg><figcaption><h3>'+fmt(theta*180/Math.PI,1)+'° apart</h3><p>The two vectors span a plane even though each has 256 coordinates. Rotate this plane so the question points right. The dashed line drops the passage onto that axis. Its horizontal coordinate is the cosine score, <strong>'+fmt(score)+'</strong>.</p></figcaption></figure>';
}
function retrievalLab(){
  const c=D.chunks[S.compare], q0=D.queryVectors[S.case], v=D.vectors[S.compare], len=Math.hypot(...q0)*Math.hypot(...v);
  const sum=(a)=>a.reduce((t,n,i)=>t+n*v[i]/len,0);const n=S.dim-1;
  return panel("Rank the six passages","Archived whole-step vectors",'<div class="toolbar">'+caseSelect()+range("Passages kept (k)","k",S.k,1,6)+'</div>'+observedQuestion()+rankRows(S.k,S.compare)+'<p class="fine">Bar scale 0 to 1 for these positive scores. Cosine similarity can range from −1 to 1. Select a row to inspect its arithmetic. The backend uses k = '+D.config.topK+'.</p>'+angleView(sum(q0),c.step)+details("Magnify the dot product · step "+c.step,'<p>Divide both vectors by their lengths. Multiply matching coordinates, then sum the 256 products.</p>'+range("Last coordinate in partial sum","dim",S.dim,1,256)+pre("q["+n+"] × d["+n+"] / (‖q‖ ‖d‖) = "+fmt(q0[n]*v[n]/len,8)+"\nSum through coordinate "+S.dim+" = "+fmt(sum(q0.slice(0,S.dim)),7)+"\nFull cosine similarity = "+fmt(sum(q0),7))+'<p class="fine">The teaching calculation uses JavaScript numbers. The backend uses float32 and rounds the displayed score to five decimal places after ranking.</p>',true)+box("What changes when k changes?","The selection above changes immediately. The saved model answer was generated with "+caseList[S.case].retrieved.length+" passages. A different k would require a new model call to observe its effect."));
}
function promptLab(){
  const cfg=D.config,p=cfg.providers[S.provider],msgs=systemMessages();
  const body={model:p.prefix+cfg.chatModel,messages:msgs,max_completion_tokens:cfg.maxOutputTokens,response_format:{type:"json_object"}};
  if(S.provider==="openrouter") body.reasoning={effort:"low"};
  else body.reasoning_effort="low";
  const variants={messages:msgs,context:JSON.parse(msgs[1].content),body};
  return panel("Inspect the model request","Current prompt with archived retrieval",'<div class="toolbar">'+caseSelect()+select("API configuration","provider",Object.keys(cfg.providers).map(k=>[k,k]),S.provider)+'</div><div class="seg">'+[["messages","Two messages"],["context","Question + context"],["body","Request body"]].map(([v,l])=>button("promptTab",l,v,S.promptTab===v)).join("")+'</div>'+pre(variants[S.promptTab])+box("What crosses the network?", "The embedding service sees input text. The chat service receives the question and the selected passage texts with their IDs, pages and steps. Similarity scores and the rest of the manual stay local."));
}
function preset(value){
  const good=caseList[0].provider_response, id=caseList[S.case].retrieved[0].id;
  if(value==="answer")return {status:"answered",claims:[{text:"Residues are retained in piles on the tank top for inspection.",citations:[id]}]};
  if(value==="gap")return {status:"evidence_gap",claims:[]};
  if(value==="uncited-gap")return {status:"evidence_gap",claims:[{text:"Piles must weigh ten kilograms.",citations:[]}]};
  if(value==="unknown")return {status:"answered",claims:[{text:"A claim with an unknown reference.",citations:["A3-8.1-99"]}]};
  if(value==="unsupported")return {status:"answered",claims:[{text:"Each pile must weigh 10 kg.",citations:[id]}]};
  if(value==="uncited")return {status:"answered",claims:[{text:good.claims[0].text,citations:[]}]};
  return {status:"answered",claims:[]};
}
function verifyDraft(raw) {
  let d;try{d=JSON.parse(raw)}catch{return ["HTTP 502 · unreadable model answer","The chat client could not parse the model content as JSON."];}
  const allow=new Set(D.rankings[S.case].slice(0,D.config.topK).map(r=>r.id));
  if(!d||!["answered","evidence_gap"].includes(d.status)||!Array.isArray(d.claims)||d.claims.length>10)return ["HTTP 502 · invalid answer","Expected a recognised status and a list with at most ten claims."];
  if(d.status==="answered"&&!d.claims.length)return ["HTTP 502 · empty answer","An answered result needs at least one evidenced claim."];
  for(const c of d.claims){
    if(!c||typeof c.text!=="string"||!c.text.trim()||!Array.isArray(c.citations)||c.citations.some(id=>!allow.has(id))||!c.citations.length||c.text.trim()===D.config.gapExplanation)return ["HTTP 502 · invalid evidence","Check the text, citation list, and membership of every ID in this question’s retrieved set."];
  }
  return d.status==="answered"?["HTTP 200 · structure accepted","IDs exist in the retrieved set. Compare the words of the claim with the passage to judge support."]:["HTTP 200 · evidence gap",d.claims.length?"The server prepends its standard explanation to the cited facts.":"The server supplies its standard explanation for the missing detail."];
}
function validationLab(){
  if(S.validateDraft===null)S.validateDraft=JSON.stringify(preset("unknown"),null,2);
  const res=S.validationOutput;
  return panel("Try to break a citation","Archived ID-only validator",'<div class="toolbar">'+caseSelect()+'</div><p>This simulator reproduces the earlier ID checks. The live app verifies an exact quote in each cited step. Allowed IDs for the selected k: <code>'+D.rankings[S.case].slice(0,D.config.topK).map(r=>esc(r.id)).join(", ")+'</code></p><div class="seg wrap">'+[["answer","Supported"],["gap","Empty gap"],["unknown","Unknown ID"],["unsupported","Invented weight"],["uncited","Missing citation"],["uncited-gap","Uncited gap fact"]].map(([v,l])=>button("preset",l,v)).join("")+'</div><label class="field wide"><span>Editable model output</span><textarea id="validation-draft" class="mono-input" rows="7">'+esc(S.validateDraft)+'</textarea></label><button class="primary" data-cmd="validate">Run checks</button>'+(res?box(res[0],res[1],res[0].includes("502")?"amber":""):'')+details("Check the underlying evidence",D.rankings[S.case].slice(0,D.config.topK).map(r=>fullPassage(chunk(r.id))).join("")));
}
function answerCard(){
  const c=caseList[S.case];
  if(S.display==="error")return box("Request failed · HTTP 502","Model service returned HTTP 401. Check the backend API key.","amber");
  return '<div class="answer-card"><span class="eyeline">'+(S.case?"Evidence gap":"Answer")+'</span>'+c.displayed_claims.map(cl=>'<p>'+esc(cl.text)+' '+cl.citations.map(id=>'<a href="#evidence-'+esc(id)+'" data-cmd="evidence" data-value="'+esc(id)+'" class="cite">'+esc(passageHeader(chunk(id)))+'</a>').join(" ")+'</p>').join("")+'</div>'+c.retrieved.map(r=>'<details id="evidence-'+esc(r.id)+'"><summary>'+esc(passageHeader(chunk(r.id)))+'</summary>'+fullPassage(chunk(r.id))+'</details>').join("");
}
function interfaceLab(){
  return panel("From JSON to the reader","Archived whole-step evidence",'<div class="toolbar">'+caseSelect()+select("Response","display",[["case","Recorded answer"],["error","Simulate API error"]],S.display)+'</div>'+observedQuestion()+answerCard()+details("Raw chat content",pre(caseList[S.case].provider_response))+details("After server validation",pre({status:caseList[S.case].provider_response.status,claims:caseList[S.case].displayed_claims,evidence:caseList[S.case].retrieved.map(r=>({...chunk(r.id),score:r.score}))})));
}
function evaluationLab(){
  const a=caseList[0].usage,b=caseList[1].usage,m=D.results.embeddings;
  const q=caseList[S.case].usage;
  return panel("Account for the two review runs","Archived two-question run",'<div class="tablewrap"><table><thead><tr><th>Inference</th><th>Input tokens</th><th>Output tokens</th><th>Upstream USD</th></tr></thead><tbody>'+[["Embeddings · one batch",m.tokens,0,m.upstream_usd],["Answer · location",a.prompt_tokens,a.completion_tokens,a.upstream_usd],["Answer · weight",b.prompt_tokens,b.completion_tokens,b.upstream_usd]].map(([l,i,o,c])=>'<tr><th>'+l+'</th><td>'+i+'</td><td>'+o+'</td><td>$'+fmt(c,8)+'</td></tr>').join("")+'</tbody></table></div>'+box("Final verification total","$"+fmt(m.upstream_usd+a.upstream_usd+b.upstream_usd,8)+" in reported upstream inference. The eight-input batch contained six source steps and both questions. The separate prompt trial is excluded.")+'<h3>Extrapolate a workload</h3><div class="toolbar">'+caseSelect()+range("Similar chat calls","cost",S.cost,1,1000)+'</div><div class="readout"><small>Estimated chat cost</small><strong class="decimal">$'+fmt(S.cost*q.upstream_usd,5)+'</strong><p>'+S.cost+' calls at the measured cost of this one answer. This assumes constant token counts and rates. It excludes embeddings, retries and hosting.</p></div>'+details("Verification boundary and tuning history",'<p>'+esc(D.results.method)+'</p><p>The first trial added an inferred benefit. After the prompt was tightened, the location answer retained a redundant sentence. The same examples guided development and evaluation.</p>'));
}
const pilots=[
  ["More documents","Build a labelled set of questions spanning several manuals before changing the retrieval engine.","Add source, edition and jurisdiction filters. Measure whether the correct passage appears in the selected passages, then evaluate alternative k values or hybrid retrieval on the same questions.","Recall at k, unsupported claims, and correct gaps on held-out questions."],
  ["A new edition","Treat the edition change as a data migration. A different file digest stops this extractor.","Inspect changed tables, run extraction into a new version, verify citations against the new pages and compare held-out answers before switching the index.","Every sampled citation opens the intended page and row, and regressions are explained."],
  ["Private material","Establish document access and inference policies before ingesting the material.","Filter the eligible corpus by the caller’s access rights before similarity search. Review the data sent to remote embeddings and chat, including retention requirements.","Test two users with different permissions and check both retrieval and displayed evidence."],
  ["More users","Measure per-stage latency, concurrency and token spend with a representative workload.","Track embedding and chat timing separately. Consider caching only where the document edition, access scope and model agree.","Compare tail latency and cost per supported answer before and after a change."]
];
function pilotLab(){
  const p=pilots[S.pilot];
  return panel("Change the constraints","Design exercise",'<div class="seg wrap">'+pilots.map((p,i)=>button("pilot",p[0],i,S.pilot===i)).join("")+'</div>'+box("First decision",p[1])+box("Implementation to evaluate",p[2])+box("How to check the benefit",p[3])+'<p class="fine">These are proposed changes for a pilot. The implemented PoC serves one fixed, public collection.</p>');
}
const labs={scope:scopeLab,pdf:pdfLab,chunks:chunkLab,embeddings:vectorLab,index:indexLab,request:requestLab,retrieval:retrievalLab,prompt:promptLab,validation:validationLab,interface:interfaceLab,evaluation:evaluationLab,pilot:pilotLab};

