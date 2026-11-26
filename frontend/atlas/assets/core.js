"use strict";
const D = window.ATLAS_DATA;
const lessons = window.HOLD_LESSONS;
const ref = window.HOLD_REFERENCE;
const caseList = D.results.cases;
const titles = {
  scope: "Collection scope", pdf: "PDF extraction", chunks: "Passage anatomy",
  embeddings: "Embedding space", index: "Local index", request: "Request contract",
  retrieval: "Similarity search", prompt: "Prompt assembly", validation: "Citation checks",
  interface: "Answer interface", evaluation: "Evaluation & cost", pilot: "Pilot decisions"
};
const groups = [
  ["Prepare the manual", ["scope", "pdf", "chunks", "embeddings", "index"]],
  ["Answer a question", ["request", "retrieval", "prompt", "validation", "interface"]],
  ["Verify and extend", ["evaluation", "pilot"]]
];
const glyphs = {
  overview:"⊞", trace:"⌁", scope:"◫", pdf:"▤", chunks:"▥", embeddings:"⠿",
  index:"▱", request:"⇄", retrieval:"≋", prompt:"▧", validation:"☑", interface:"▣",
  evaluation:"▦", pilot:"◇", glossary:"Aa", code:"‹›", quiz:"?", failures:"!"
};
const S = {
  case:0, step:1, row:0, magnify:false, field:"text", page:20, vector:"c0", dim:1,
  k:D.config.topK, compare:2, build:0, stop:false, request:"Where should residues be collected?",
  provider:"openrouter", promptTab:"messages", validateDraft:null, validationOutput:null,
  display:"case", cost:100, pilot:0, glossary:"", quizIndex:0, quizAnswers:{},
  traceAt:0, tab:"", scopePage:20
};
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function slug(value) {return encodeURIComponent(String(value));}
function fmt(value, n=5) {return Number(value).toFixed(n);}
function glyph(name) {return '<span class="glyph" aria-hidden="true">'+esc(glyphs[name]||"·")+'</span>';}
function tag(label) {return '<span class="tag">'+esc(label)+'</span>';}
function button(cmd, label, value="", active=false) {
  return '<button type="button" class="control'+(active?' on':'')+'" data-cmd="'+esc(cmd)+'" data-value="'+esc(value)+'" aria-pressed="'+active+'">'+esc(label)+'</button>';
}
function options(pairs, current) {
  return pairs.map(([value,label])=>'<option value="'+esc(value)+'"'+(String(value)===String(current)?" selected":"")+'>'+esc(label)+'</option>').join("");
}
function select(label, key, pairs, value) {
  return '<label class="field"><span>'+esc(label)+'</span><select data-setting="'+esc(key)+'">'+options(pairs,value)+'</select></label>';
}
function range(label,key,value,min,max) {
  return '<label class="range"><span>'+esc(label)+' <output>'+esc(value)+'</output></span><input type="range" min="'+min+'" max="'+max+'" value="'+value+'" data-setting="'+key+'"></label>';
}
function details(name, body, open=false) {return '<details'+(open?' open':'')+'><summary>'+esc(name)+'</summary><div class="detail-content">'+body+'</div></details>';}
function box(label, text, kind="") {return '<div class="note '+kind+'"><strong>'+esc(label)+'</strong><p>'+esc(text)+'</p></div>';}
function pre(value) {return '<pre class="code-block">'+esc(typeof value==="string"?value:JSON.stringify(value,null,2))+'</pre>';}
function codeURL(file,symbol="") {return '#code/'+slug(file)+(symbol?'/'+slug(symbol):'');}
function chapterURL(id) {return '#lesson/'+id;}
function chapterLink(id,label) {return '<a class="textlink" href="'+chapterURL(id)+'">'+esc(label||titles[id])+'</a>';}
function chunk(id) {return D.chunks.find(c=>c.id===id);}
function byStep(n) {return D.chunks.find(c=>c.step===Number(n));}
function passageHeader(c) {return c.source+" · p. "+c.page+" · § "+c.section+" · step "+c.step;}
function fullPassage(c) {return '<div class="passage"><div class="mono">'+esc(c.id)+' · '+esc(passageHeader(c))+'</div><p>'+esc(c.text)+'</p></div>';}
function caseSelect() {return select("Recorded question","case",[[0,"Residue location"],[1,"Minimum pile weight"]],S.case);}
function chunkSelect() {return select("Inspection step","step",D.chunks.map(c=>[c.step,"Step "+c.step+" · page "+c.page]),S.step);}
function userPayload(retrieved) {
  const c=caseList[S.case];
  const passages=retrieved.map(hit=>{const a=chunk(hit.id);return {id:a.id,page:a.page,step:a.step,text:a.text};});
  return {question:c.question,passages};
}
function systemMessages() {
  const selected=D.rankings[S.case].slice(0,D.config.topK);
  return [{role:"system",content:D.prompt},{role:"user",content:JSON.stringify(userPayload(selected))}];
}
function lessonHeader(section,title,description) {
  return '<div class="crumb"><a href="#brief">Case study</a><span>/</span>'+esc(section)+'</div><div class="page-intro"><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p></div>';
}
function panel(title, meta, body) {
  return '<section class="instrument"><header class="instrument-head"><h2>'+esc(title)+'</h2>'+tag(meta)+'</header><div class="instrument-body">'+body+'</div></section>';
}
function route() {
  return (location.hash.slice(1)||"brief").split("/").map(s=>{try{return decodeURIComponent(s)}catch{return s}});
}
function observedQuestion() {return '<blockquote class="question">'+esc(caseList[S.case].question)+'</blockquote>';}
function jump(file,symbol,label) {return '<a class="code-link" href="'+codeURL(file,symbol)+'">'+glyph("code")+esc(label||file+" · "+symbol)+'</a>';}
function diagramSVG() {
  const pageLines=Array.from({length:6},(_,i)=>'<path d="M9 '+(15+i*6)+' h'+(i%3===0?29:43)+'" />').join("");
  const matrix=Array.from({length:64},(_,i)=>{
    const v=D.vectors[0][i], c=v>=0?"#78c4cd":"#eac376";
    return '<rect x="'+((i%8)*7)+'" y="'+(Math.floor(i/8)*6)+'" width="4.4" height="3.2" fill="'+c+'" opacity="'+(.32+Math.min(1,Math.abs(v)*6))+'"/>';
  }).join("");
  const block=(n,points)=>'<path d="'+points+'" stroke="#8bbec8" stroke-width="1" fill="'+n+'"/>';
  return '<svg class="blueprint" viewBox="0 0 700 210" role="img" aria-label="Schematic. PDF page stacks become a numeric index. A question selects the highest-ranked passages and the model cites them. The index detail shows 64 actual signed components of step one."><defs><pattern id="pg" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#416476" stroke-width=".55"/></pattern><pattern id="pg2" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#pg)"/><path d="M100 0H0V100" fill="none" stroke="#66808a" stroke-width=".65"/></pattern></defs><rect width="700" height="210" fill="url(#pg2)"/><g stroke="#e8b35b" stroke-width="1.4" stroke-dasharray="4 6" fill="none"><path d="M163 115H213L243 92H287"/><path d="M360 120H425L456 92H505"/></g><g fill="#fbcd72"><circle cx="207" cy="115" r="3"/><circle cx="422" cy="120" r="3"/></g>'+
  '<g transform="translate(64 56)"><g transform="matrix(1,.24,-.6,.77,20,14)" stroke-linejoin="round">'+[18,12,6,0].map((n,i)=>'<g transform="translate(0 '+n+')"><rect width="98" height="65" rx="2" fill="'+(i===3?'#345766':'#1c3b49')+'" stroke="#a7c8ce"/><g stroke="#9bbcc3" stroke-width="1.2">'+pageLines+'</g><path d="M63 15h23v35H63z M63 26h23 M72 15v35" fill="none" stroke="#eed090"/></g>').join("")+'</g></g>'+
  '<g transform="translate(274 55)">'+block('#284b5c','M0 30l56-27 67 28-57 30Z')+block('#1c394a','M0 30v47l66 32V61Z')+block('#315666','M66 61l57-30v47l-57 31Z')+'<g transform="matrix(.74,-.35,.79,.33,16,27)">'+matrix+'</g><g stroke="#96bfca" stroke-width=".8" fill="none"><path d="M0 42l66 31 57-30M0 53l66 31 57-30M0 64l66 31 57-30"/></g><g fill="#eabc76"><circle cx="108" cy="56" r="2"/><circle cx="108" cy="67" r="2"/></g></g>'+
  '<g transform="translate(500 39) rotate(5 60 65)"><path d="M12 18l94 1 0 91-94-1z" fill="#294758" stroke="#88adba"/><rect x="4" y="10" width="94" height="91" rx="3" fill="#284657" stroke="#92b6c2"/><rect width="94" height="91" rx="3" fill="#284454" stroke="#c0d9da"/><g stroke="#adcad1" stroke-width="2"><path d="M11 16h44M11 26h69M11 34h60M11 51h40M11 60h65M11 68h44"/></g><g fill="#ecc573"><rect x="57" y="12" width="15" height="7" rx="2"/><rect x="55" y="47" width="15" height="7" rx="2"/></g></g>'+
  '<g fill="#c6dadd" font-family="monospace" font-size="12"><text x="67" y="183">SOURCE PAGES</text><text x="269" y="183">VECTOR INDEX</text><text x="498" y="183">CITED ANSWER</text></g></svg>';
}

