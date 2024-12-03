(()=>{var t={413:(t,n,o)=>{const r=o(896),i=o(937);function a(t="-",e,n){const o=c(1e3*e),r=c(1e3*n);return"+"===t?Math.abs(c((r+o)/1e3)):Math.abs(c((r-o)/1e3))}function s(t){const e=i.join("|");return!(!new RegExp(`\\b(?:${e})\\b`,"i").test(t)&&!/!remove!/.test(t))}function c(t){return+(Math.round(t+"e+3")+"e-3")}async function d(t,e){const n=["-hide_banner","-show_format","-show_streams","-of","json",t],o=await m("ffprobe",n,e,!1);e.write(`Video ${t} Specifications ----------------------------------\n${o}\n\n`)}async function l(t,e,n){const o=["-v","error","-hide_banner","-print_format","flat","-show_entries","mkv"===e?"format=duration":"stream=duration","-of","default=noprint_wrappers=1:nokey=1","-select_streams","v:0",`${t}.${e}`];let r=await m("ffprobe",o,n,!1);return r=+r.trim(),n.write(`Video Length: Sec.Milli: ${r}, Time: ${u(r)}\n\n`),r}function u(t){const[e,n="000"]=t.toString().split("."),o=Math.floor(e/3600),r=o.toString().padStart(2,"0"),i=Math.floor(e%3600/60);return`${r}:${i.toString().padStart(2,"0")}:${(e-(3600*o+60*i)).toString().padStart(2,"0")},${n.toString().padEnd(3,"0")}`}async function m(t,n=[],r,i=!0){const{spawn:a}=o(317);return new Promise(((o,s)=>{let c="";try{const e=`Running command: ${t} ${n.join(" ")}\n\n`;r.write(e),console.log(e);const d=a(t,n);d.stdout.on("data",(t=>{i&&console.log(t.toString()),c+=t})),d.stderr.on("data",(t=>{i&&console.log(t.toString()),c+=t})),d.on("close",(e=>{if(0===e)o(c);else{const o=new Error(`Command "${t} ${n.join(" ")}" exited with code ${e}`);o.code=e,o.stdout=c,r.write(`Error: Command "${t} ${n.join(" ")}" exited with code ${e}.\n${c}\n\n`),s(o)}})),d.on("error",(t=>{r.write(t.toString()),s(t)}))}catch(o){r.write(`Error: Command "${t} ${n.join(" ")}" exited with error.\nSTDOUT: ${c}\nERROR: ${e}\n\n`),s(o)}}))}function p(t){if(!t)return"";const[e,n,o,r=0]=t.split(/:|,/);return+`${60*+e*60+60*+n+ +o}.${r}`}t.exports={containsSwearWords:s,convertMsToTime:function(t){function e(t){return t.toString().padStart(2,"0")}let n=Math.floor(t/1e3),o=Math.floor(n/60),r=Math.floor(o/60);return n%=60,o%=60,r%=24,`${e(r)}:${e(o)}:${e(n)}`},deleteFiles:function(t,e){e.write(`Deleting files: ${t.join(", ")}\n`);for(const n of t)r.existsSync(n)?(r.unlinkSync(n),console.log("[34m",`${n} was deleted`),console.log("[0m",""),e.write(`${n} was deleted\n`)):(console.log("[34m",`File ${n} was not found!`),console.log("[0m",""),e.write(`File ${n} was not found!\n`));e.write("\n\n")},extractSubtitle:async function(t,e){const{video:n,args:o,subName:r}=t,i=["-hide_banner","-v","error","-i",n,"-map",`0:s:${o["subtitle-number"]?o["subtitle-number"]:0}`,r];console.log("[34m",`Could not find Subtitle. Trying to Extract ${r}`),console.log("[0m",""),e.write(`Could not find subtitle ${r}. Trying to extract from ${n}.\n\n`);try{const t=await m("ffmpeg",i,e);return e.write(`extractSubtitles:\nstdout: ${t}\n\n`),console.log("[34m",`Extracted ${r}`),console.log("[0m",""),e.write(`Extracted ${r} from ${n}`),!0}catch(t){return console.log("No srt found!",t),e.write(`No srt found! ${t}\n\n`),!1}},filterGraphAndEncode:async function(t,e,n=[]){const{args:o,name:i,cleanSubName:a,cleanVideoName:s,video:c,videoMeta:l}=t,u=!o?.cpu;let p=o?.quality?+o.quality:26;Number.isNaN(p)&&(p=26);const $=o?.["audio-number"]?o["audio-number"]:0,f=["-pix_fmt","yuv420p","-profile",o?.h264?"high":"main","-c:v",o?.h264?"h264_nvenc":"hevc_nvenc"],w=[...o?.["10-bit"]?["-pix_fmt","p010le","-profile:v","main10","-c:v","hevc_nvenc"]:f,"-r",l.frameRate,...o?.smallest?["-preset","p7","-multipass",2]:["-preset","p1","-multipass",0],"-b:v",0,"-bf",0,"-g",300,"-me_range",36,"-subq",9,"-keyint_min",1,"-qdiff",20,"-qcomp",.9,"-qmin",17,"-qmax",51,"-qp",p,"-rc","constqp","-tune","hq","-rc-lookahead",4,"-keyint_min",1,"-qdiff",20,"-qcomp",.9],g=["-c:v","libx264","-crf",p],h=["-c:a",l.audioCodec,"-b:a",l.audioBitRate,"-ar",l.audioSampleRate],b=["-map_metadata","-1",...o?.["no-chapters"]?["-map_chapters","-1"]:""],S=["-metadata",`creation_time=${(new Date).toISOString()}`,"-metadata",`title='${i}.mp4'`],v=r.existsSync(a);let x=["-map","0:v","-map",`0:a:${$}`];if(!o?.skip){let t="",e=0,r="";for(const[o,[i,a]]of n.entries())t+=`[0:v]trim=start=${i}:end=${a},setpts=PTS-STARTPTS[${o}v];[0:a:${$}]atrim=start=${i}:end=${a},asetpts=PTS-STARTPTS[${o}a];`,r+=`[${o}v][${o}a]`,e++;if(x=["-filter_complex",`${t}${r} concat=n=${e}:v=1:a=1[outv][outa]`,"-map","[outv]","-map","[outa]"],o?.["video-filter"]){const t=n.map((([t,e])=>`between(t,${t},${e})`));x=["-vf",`select='${t.join("+")}', setpts=N/FRAME_RATE/TB`,"-af",`aselect='${t.join("+")}', asetpts=N/SAMPLE_RATE/TB`]}}const N=["-y",o?.report?"-report":"","-hide_banner","-v","error","-stats",...u?["-hwaccel","cuda"]:"","-i",c,...v?["-i",a]:"",...u?w:g,...v?["-c:s","mov_text","-metadata:s:s:0","language=eng"]:"",...h,...b,...S,...x,...v&&!o?.["video-filter"]?["-map","1:s:0"]:"",s],T=await m("ffmpeg",N.filter((t=>""!==t)),e);e.write(`filterGraphAndEncode: --------------------------------------------------\n${T}\n\n`),await d(t.cleanVideoName,e)},getArgs:function(){return Object.fromEntries(process.argv.slice(2).join(" ").split(/ -{1,2}/).map((t=>{const e=t.trim().toLowerCase().replace(/^-{1,2}/,"").split(/\s|=/);return e.length<2&&e.push(!0),e})).filter((t=>!!t[0])))},getCuts:async function(t,e){const{name:n,args:o,ext:i,frameRate:c,subName:d,cleanSubName:m}=t,$=function(t,e){const n=r.readFileSync(t,"utf-8").split(/\r?\n\r?\n\d{1,5}\r?\n?$/m).map(((t,e)=>{let n="",o="";e>0?[n,...o]=t.trim().split(/\r?\n/):[_,n,...o]=t.trim().split(/\r?\n/);const[r,i]=n.split(" --\x3e ");return{id:e+1,start:r,end:i,text:o.join("\n").trim()}})),o=n.reduce(((t,e)=>{const{id:n,start:o,end:r,text:i}=e;return t+`${n}\n${o} --\x3e ${r}\n${i}\n\n`}),"");return e.write(`splitSubtitles:\n${o}\n\n`),n}(d,e);e.write("Swear Words Keeps ----------------------------------------------\n\tSRT Time\tSeconds\tFrame\n");const f=[],w=[];let g=0,h="";const b=[];let S=0;for(const[t,n]of $.entries()){const{id:o,start:r,end:i,text:d}=n,l=Math.floor(p(r)),m=Math.ceil(p(i));if(s(d)){if(0===l){S=m;const t=Math.abs(m-l);g+=t,h+=`Start time was zero. Seconds removed: ${t}.\t`}else{if(Math.abs(l-S)>=2){const t=`between(t,${S},${l})`;b.push([S,l]);const n=Math.abs(m-l);g+=n,h+=`${t}\tSecondsRemoved: ${n}\t`,e.write(`Start:\t${r}\t${l}\t${l*c}\nEnd:\t${i}\t${m}\t${m*c}\n\n`)}else{const t=Math.abs(m-S);g+=t,h+=`Time was less than two seconds! Skipping!\t\tSecondsRemoved: ${t}\t`}S=m}w.push({id:o,start:r,end:i,text:d})}else{const t=u(a("-",p(r),g)),e=u(a("-",p(i),g));f.push({id:o,start:t,end:e,text:d})}h+=`index: ${t}, \tid: ${o}\ts: ${S},\tstart: ${l}s, ${r}\tend: ${m}s, ${i}\t\tTotalSecondsRemoved: ${g}s.\n`}const v=await l(n,i,e);S<v&&b.push([S,Math.floor(v)]),e.write(`Keep Video Segments ---------------------------------------\n${JSON.stringify(b)}\n\n`),e.write(`getCuts: -keepStr. This logs the time removed from subtitles.\n${h}\n\n`);const x=f.map(((t,e)=>({...t,id:e+1}))).reduce(((t,e)=>{const{id:n,start:o,end:r,text:i}=e;return t+`${n}\n${o} --\x3e ${r}\n${i}\n\n`}),"");r.writeFileSync(m,x),e.write(`${m}\n${x}\n\n`);const N=w.reduce(((t,e)=>{const{id:n,start:o,end:r,text:i}=e;return t+`${o} - ${r} \t${i.trim().replace(/\r?\n/g," ")}\n`}),"");return e.write(`getCuts: -Swear Words\n${N}\n\n`),b},getName:function(t){const e=t.split("."),n=e.pop();return{name:e.join("."),ext:n}},getMetadata:async function(t,e,n){const o=["-v","quiet","-hide_banner","-show_format","-show_streams","-of","json",t],r=await m("ffprobe",o,n,!1),i=JSON.parse(r),a=e?.["audio-number"]?+e["audio-number"]+1:1,s=i?.streams[0],c=i?.streams[a];let d=24;const l=s?.r_frame_rate,u=l?.split("/");if(2!==u.length)throw new Error("Video Frame Rate not Found.");const[p,$]=u;Number.isNaN(+p)||Number.isNaN(+$)?n.write("Frame Rate Not Found. -----------------------------\n\n"):d=+(+p/+$).toFixed(3);let f=+c?.sample_rate,w=+c?.bit_rate,g=c?.codec_name;return(Number.isNaN(f)||Number.isNaN(w)||!g)&&(n.write(`Audio Codec Problem. Using defaults. -----------------------\nAudio Sample Rate: ${f}\nAudio Bit Rate: ${w}\nAudio Codec: ${g}\n\n`),w=48e3,w="448k",g="ac3"),{frameRateString:l,frameRate:d,audioSampleRate:f,audioBitRate:w,audioCodec:g}},getVideoDuration:l,getVideoNames:function(){const t=["\\.mp4$","\\.mkv$","\\.avi$","\\.webm$"],e=new RegExp(t.join("|")),n=new RegExp(["output","clean","temp","sanitize"].map((e=>t.map((t=>`${e}${t}`)).join("|"))).join("|")),o=r.readdirSync(process.cwd()).filter((t=>e.test(t))).filter((t=>!n.test(t)));return console.log(o),o},recordMetadata:d,spawnShell:m,transcribeVideo:async function(t,e){const{video:n}=t,o=`Could not extract subtitles from ${n}.\nStarting Docker with AI transcription.\nThis will take a few minutes to transcribe video.\n\n`;e.write(o),console.log("[35m",o),console.log("[0m","");const r=["run","--rm","-v",`${process.cwd()}:/data`,"-v",`${process.cwd()}/.whisper:/app/.whisper`,"jveldboom/video-swear-jar:v1","clean","--input",n,"--model","tiny.en","--language","en"],i=await m("docker",r,e);e.write(`transcribeVideo:\nstdout: ${i}\n\n`)}}},317:t=>{"use strict";t.exports=require("child_process")},896:t=>{"use strict";t.exports=require("fs")},937:t=>{"use strict";t.exports=JSON.parse('["arse","ass","asshole.*","bitch.*","bullshit","blow.?job","cock","cocksucker.*","cunt.*","damn","dick.?.?.?","dickhead","dildo","dyke","dumbass.*","fuck.*","god.?damn.*","holy.?shit","horseshit","mother.?fuc.*","nigg.*","penis.*","pussy","shit.*","smartass","tits?","titties","twat"]')}},n={};function o(e){var r=n[e];if(void 0!==r)return r.exports;var i=n[e]={exports:{}};return t[e](i,i.exports,o),i.exports}!async function(){const t=o(896),{convertMsToTime:e,deleteFiles:n,extractSubtitle:r,filterGraphAndEncode:i,getArgs:a,getCuts:s,getName:c,getMetadata:d,getVideoNames:l,recordMetadata:u,transcribeVideo:m}=o(413),p=a(),$=l();for(const o of $){const a=(new Date).getTime();console.log(o);const{name:l,ext:f}=c(o),w=`${l}.log`,g=t.createWriteStream(w);try{g.write(`Video Names ------------------------------------\n${$.join("\n")}\n\n`);const c={args:p,cleanSubName:`${l}-clean.srt`,cleanVideoName:`${l}-clean.mp4`,ext:f,name:l,logName:w,subName:`${l}.srt`,transcribeVideo:!1,video:o,videoMeta:await d(o,p,g)};if(g.write(`State -------------------------------------------\n${JSON.stringify(c,null,2)}\n\n`),await u(c.video,g),!p?.skip)if(t.existsSync(c.subName))g.write(`Subtitle ${c.subName} found!\n\n`);else if(!await r(c,g)){c.args.skip=!0;const t=await m(c,g);if(console.log("out",t),/No swear words found/.test(t?.stdout||"")){console.log("[35m","Transcription done! No swear words found."),console.log("[0m",""),g.write("Transcription done! No swear words found.\n\n");const t=(new Date).getTime();g.write(`Time to Complete ${o}: ${e(t-a)}\n\n`),g.end();continue}c.video=`${c.name}-output.${c.ext}`,await i(c,g);const r=[`${l}-cut.txt`,`${l}.json`,c.video,`${l}-cut-words.txt`];p.debug||n(r,g);const s=(new Date).getTime();g.write(`Time to Complete ${o}: ${e(s-a)}\n\n`),g.end();continue}let h=[];p?.skip||(h=await s(c,g)),await i(c,g,h);const b=[c.cleanSubName];p?.clean&&b.push(c.video,c.subName),p?.["clean-all"]&&b.push(c.video,c.subName,c.logName),p?.debug||n(b,g);const S=(new Date).getTime();g.write(`Time to Complete ${o}: ${e(S-a)}\n\n`),g.end()}catch(t){g.end(),g.on("close",(()=>{throw new Error(t)}))}}}()})();