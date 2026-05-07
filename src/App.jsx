import { useState, useEffect } from "react";

const SCOPES = ["user-top-read","user-read-private","user-read-email"].join(" ");
const REGION_MAP = {
  US:"NA",CA:"NA",MX:"NA",BR:"LATAM",AR:"LATAM",CO:"LATAM",CL:"LATAM",PE:"LATAM",
  GB:"EU",DE:"EU",FR:"EU",IT:"EU",ES:"EU",NL:"EU",SE:"EU",NO:"EU",DK:"EU",
  FI:"EU",PL:"EU",PT:"EU",BE:"EU",AT:"EU",CH:"EU",IE:"EU",TR:"EU",
  JP:"APAC",KR:"APAC",AU:"APAC",NZ:"APAC",IN:"APAC",SG:"APAC",
  ID:"APAC",TH:"APAC",PH:"APAC",MY:"APAC",VN:"APAC",TW:"APAC",HK:"APAC",
  SA:"MEA",AE:"MEA",EG:"MEA",ZA:"MEA",NG:"MEA",KE:"MEA",IL:"MEA",PK:"MEA",
};
const COUNTRY_NAMES = {
  US:"United States",CA:"Canada",MX:"Mexico",BR:"Brazil",AR:"Argentina",
  GB:"United Kingdom",DE:"Germany",FR:"France",IT:"Italy",ES:"Spain",
  NL:"Netherlands",SE:"Sweden",NO:"Norway",DK:"Denmark",FI:"Finland",
  JP:"Japan",KR:"South Korea",AU:"Australia",NZ:"New Zealand",IN:"India",
  SG:"Singapore",ID:"Indonesia",TH:"Thailand",PH:"Philippines",MY:"Malaysia",
  SA:"Saudi Arabia",AE:"UAE",EG:"Egypt",ZA:"South Africa",TR:"Turkey",
  PL:"Poland",PT:"Portugal",BE:"Belgium",AT:"Austria",CH:"Switzerland",
  CO:"Colombia",CL:"Chile",PE:"Peru",
};

function calcScore(artists,tracks,genres){
  const gs=Math.min(35,Math.round((new Set(genres).size/20)*35));
  const ap=artists.reduce((s,a)=>s+(a.popularity||50),0)/Math.max(artists.length,1);
  const os=Math.round(((100-ap)/100)*30);
  const ds=Math.min(20,Math.round((artists.length/50)*20));
  const yr=tracks.map(t=>t.album?.release_date?parseInt(t.album.release_date):null).filter(Boolean);
  const es=yr.length>1?Math.min(15,Math.round(((Math.max(...yr)-Math.min(...yr))/60)*15)):0;
  return Math.min(100,gs+os+ds+es);
}
function scoreColor(s){if(s>=80)return"#4ade80";if(s>=60)return"#c8b99a";if(s>=40)return"#f59e0b";return"#e05555";}
function scoreLabel(s){if(s>=85)return"Connoisseur";if(s>=70)return"Curator";if(s>=55)return"Explorer";if(s>=40)return"Mainstream";return"Casual";}

function genVerifier(){const a=new Uint8Array(32);window.crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");}
async function genChallenge(v){const d=await window.crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");}
async function spFetch(ep,token){const r=await fetch("https://api.spotify.com/v1"+ep,{headers:{Authorization:"Bearer "+token}});if(!r.ok)throw new Error("Spotify "+r.status);return r.json();}

// ── Logo ─────────────────────────────────────────────────────────────
function SoniqLogo({size=32}){
  const bars=[{h:5,o:0.3},{h:14,o:0.55},{h:21,o:1},{h:17,o:0.72},{h:8,o:0.38}];
  const bw=4, gap=3, total=bars.length*bw+(bars.length-1)*gap;
  const startX=(40-total)/2;
  return(
    <div style={{display:"flex",alignItems:"center",gap:"11px"}}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="9" fill="#0a0a0a"/>
        <rect width="40" height="40" rx="9" fill="none" stroke="url(#lg)" strokeWidth="1"/>
        <defs><linearGradient id="lg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#6b4f0e"/><stop offset="50%" stopColor="#c8b99a"/><stop offset="100%" stopColor="#6b4f0e"/></linearGradient></defs>
        {bars.map((b,i)=>{
          const x=startX+i*(bw+gap);
          const y=(40-b.h)/2;
          return <rect key={i} x={x} y={y} width={bw} height={b.h} rx="2" fill="#c8b99a" opacity={b.o}/>;
        })}
      </svg>
      <span style={{fontSize:size*0.56+"px",fontWeight:700,letterSpacing:"5px",color:"#f0ede8",fontFamily:"'DM Sans',sans-serif"}}>SONIQ</span>
    </div>
  );
}

// ── Score Ring ────────────────────────────────────────────────────────
function ScoreRing({score,size=180}){
  const r=(size-18)/2,circ=2*Math.PI*r,offset=circ-(score/100)*circ,color=scoreColor(score);
  return(
    <div style={{position:"relative",width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width={size} height={size} style={{position:"absolute",transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#161616" strokeWidth="9"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 1.8s cubic-bezier(0.16,1,0.3,1)",filter:`drop-shadow(0 0 12px ${color}66)`}}/>
      </svg>
      <div style={{textAlign:"center",zIndex:1}}>
        <div style={{fontSize:size*0.26+"px",fontWeight:700,color,lineHeight:1,letterSpacing:"-1px"}}>{score}</div>
        <div style={{fontSize:"10px",color:"#666",letterSpacing:"3px",textTransform:"uppercase",marginTop:"6px",fontWeight:500}}>{scoreLabel(score)}</div>
      </div>
    </div>
  );
}

// ── Rec Card ──────────────────────────────────────────────────────────
function RecCard({item,type,index}){
  return(
    <div style={{background:"#0e0e0e",border:"1px solid #1a1a1a",borderRadius:"12px",padding:"16px 18px",display:"flex",gap:"14px",alignItems:"flex-start",animation:`fi 0.4s ease ${index*0.07}s both`,transition:"border-color 0.2s"}}
      onMouseOver={e=>e.currentTarget.style.borderColor="#2a2a2a"}
      onMouseOut={e=>e.currentTarget.style.borderColor="#1a1a1a"}>
      <div style={{width:"34px",height:"34px",borderRadius:"8px",background:"#141414",border:"1px solid #222",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"14px",fontWeight:700,color:"#c8b99a",letterSpacing:"-0.5px"}}>{index+1}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:"14px",fontWeight:600,color:"#f0ede8",marginBottom:"3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{type==="artists"?item.name:item.title}</div>
        <div style={{fontSize:"11px",color:"#666",marginBottom:"7px"}}>{type==="artists"?item.genre:type==="albums"?item.artist+" · "+item.year:item.artist}</div>
        <div style={{fontSize:"12px",color:"#888",lineHeight:1.6}}>{item.why}</div>
      </div>
    </div>
  );
}

// ── Leaderboard Row ───────────────────────────────────────────────────
function LbRow({entry,rank,isUser}){
  const medal=rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":null;
  return(
    <div style={{display:"flex",alignItems:"center",gap:"14px",padding:"13px 16px",borderRadius:"10px",background:isUser?"#141210":"#0a0a0a",border:`1px solid ${isUser?"#c8b99a33":"#141414"}`,marginBottom:"6px"}}>
      <div style={{width:"28px",textAlign:"center",fontSize:medal?"17px":"12px",color:medal?"#f0ede8":"#444",fontWeight:700,flexShrink:0}}>{medal||rank}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:"13px",fontWeight:500,color:isUser?"#c8b99a":"#aaa",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {entry.display_name||"Anonymous"}
          {isUser&&<span style={{fontSize:"9px",color:"#6a5020",marginLeft:"10px",letterSpacing:"2px",background:"#1a1710",padding:"2px 7px",borderRadius:"100px"}}>YOU</span>}
        </div>
        <div style={{fontSize:"10px",color:"#444",marginTop:"2px"}}>{COUNTRY_NAMES[entry.country]||entry.country||"Unknown"}</div>
      </div>
      <div style={{fontSize:"20px",fontWeight:700,color:scoreColor(entry.score),flexShrink:0,letterSpacing:"-0.5px"}}>{entry.score}</div>
    </div>
  );
}

const STEPS=["Connecting to Spotify…","Reading your listening history…","Analysing genre diversity…","Calculating obscurity index…","Consulting the taste oracle…","Generating recommendations…","Saving your score…","Finalising…"];

export default function App(){
  const [screen,setScreen]=useState("landing");
  const [token,setToken]=useState(null);
  const [profile,setProfile]=useState(null);
  const [analysis,setAnalysis]=useState(null);
  const [recs,setRecs]=useState(null);
  const [score,setScore]=useState(null);
  const [leaderboard,setLeaderboard]=useState([]);
  const [lbTab,setLbTab]=useState("global");
  const [lbLoading,setLbLoading]=useState(false);
  const [step,setStep]=useState(0);
  const [userRank,setUserRank]=useState(null);
  const [activeTab,setActiveTab]=useState("artists");
  const [error,setError]=useState(null);

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const code=p.get("code");
    if(!code)return;
    window.history.replaceState({},"","/");
    const verifier=sessionStorage.getItem("pkce_verifier");
    if(!verifier)return;
    (async()=>{
      try{
        const r=await fetch("/api/spotify-token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,verifier,redirectUri:window.location.origin+"/callback"})});
        const d=await r.json();
        if(d.access_token){setToken(d.access_token);sessionStorage.setItem("sp_token",d.access_token);}
        else setError("Spotify auth failed — please try again.");
      }catch(e){setError("Connection error.");}
    })();
  },[]);

  useEffect(()=>{const t=sessionStorage.getItem("sp_token");if(t)setToken(t);},[]);
  useEffect(()=>{if(token&&screen==="landing")runAnalysis(token);},[token]);

  async function loginWithSpotify(){
    const verifier=genVerifier(),challenge=await genChallenge(verifier);
    sessionStorage.setItem("pkce_verifier",verifier);
    window.location.href="https://accounts.spotify.com/authorize?"+new URLSearchParams({
      client_id:import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      response_type:"code",redirect_uri:window.location.origin+"/callback",
      code_challenge_method:"S256",code_challenge:challenge,scope:SCOPES,
    });
  }

  async function runAnalysis(t){
    setScreen("analyzing");let si=0;
    const tick=setInterval(()=>{si=Math.min(si+1,STEPS.length-1);setStep(si);},1100);
    try{
      const [prof,aS,aM,tS]=await Promise.all([
        spFetch("/me",t),
        spFetch("/me/top/artists?limit=50&time_range=short_term",t),
        spFetch("/me/top/artists?limit=50&time_range=medium_term",t),
        spFetch("/me/top/tracks?limit=50&time_range=medium_term",t),
      ]);
      setProfile(prof);
      const allA=Array.from(new Map([...aS.items,...aM.items].map(a=>[a.id,a])).values());
      const genres=allA.flatMap(a=>a.genres),tracks=tS.items;
      const s=calcScore(allA,tracks,genres);setScore(s);
      const gf={};genres.forEach(g=>{gf[g]=(gf[g]||0)+1;});
      const topGenres=Object.entries(gf).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([g])=>g);
      const data={topArtists:allA.slice(0,10),topTracks:tracks.slice(0,5),topGenres};
      setAnalysis(data);
      clearInterval(tick);setStep(5);
      const r=await getRecommendations(data,s);setRecs(r);
      setStep(6);
      const region=REGION_MAP[prof.country]||"OTHER";
      await fetch("/api/supabase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"upsert",data:{spotify_id:prof.id,display_name:prof.display_name,country:prof.country,region,score:s,genres:topGenres,top_artists:allA.slice(0,5).map(a=>a.name)}})});
      setStep(7);
      await loadLeaderboard("global",prof);
      setScreen("results");
    }catch(e){clearInterval(tick);setError(e.message);setScreen("landing");}
  }

  async function getRecommendations(data,s){
    const currentArtists=data.topArtists.map(a=>a.name).join(", ");
    const currentTracks=data.topTracks.map(t=>t.name).join(", ");
    const prompt=`You are a world-class music curator with encyclopedic knowledge of underground and emerging artists.

Listener's CURRENT top artists (DO NOT recommend any of these or similar mainstream versions): ${currentArtists}
Listener's CURRENT top tracks (DO NOT recommend any of these): ${currentTracks}
Top genres: ${data.topGenres.join(", ")}
Taste score: ${s}/100

Your task: Recommend music they have almost certainly NOT heard yet. These must be genuinely fresh discoveries — not the obvious next step, but the perfect unexpected one. Avoid any artist that appears in their current listening. Push into adjacent genres and scenes they haven't explored.

Respond ONLY with valid JSON (no markdown, no backticks):
{"artists":[{"name":"","genre":"","why":""}],"albums":[{"title":"","artist":"","year":0,"why":""}],"tracks":[{"title":"","artist":"","why":""}],"tasteReview":"2-3 sentence sharp, specific review of their taste — not generic","tastePersonality":"Two-word descriptor e.g. Nocturnal Adventurer"}

Exactly 5 items per array. Be specific. No placeholder text.`;
    const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1500,messages:[{role:"user",content:prompt}]})});
    const d=await r.json();
    return JSON.parse((d.content?.[0]?.text||"").replace(/```json|```/g,"").trim());
  }

  async function loadLeaderboard(tab,prof){
    setLbLoading(true);
    try{
      const p=prof||profile;
      const filter=tab==="global"?{}:tab==="region"?{region:REGION_MAP[p?.country]||"OTHER"}:{country:p?.country};
      const r=await fetch("/api/supabase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"leaderboard",filter})});
      const d=await r.json();const rows=d.data||[];
      setLeaderboard(rows);
      if(p){const rank=rows.findIndex(r=>r.spotify_id===p.id);setUserRank(rank>=0?rank+1:null);}
    }catch(e){console.error(e);}
    setLbLoading(false);
  }

  function switchLbTab(t){setLbTab(t);loadLeaderboard(t,profile);}
  function logout(){sessionStorage.removeItem("sp_token");sessionStorage.removeItem("pkce_verifier");setToken(null);setProfile(null);setAnalysis(null);setRecs(null);setScore(null);setLeaderboard([]);setUserRank(null);setScreen("landing");}

  return(
    <div style={{minHeight:"100vh",background:"#080808",color:"#f0ede8",fontFamily:"'DM Sans',sans-serif",overflowX:"hidden"}}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:#c8b99a22}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#1e1e1e;border-radius:2px}
        @keyframes fi{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes su{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
        @keyframes waveBar{0%,100%{transform:scaleY(0.2)}50%{transform:scaleY(1)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .fade-in{animation:fi 0.55s ease forwards}
        .su{animation:su 0.5s cubic-bezier(0.16,1,0.3,1) forwards}
        .shimmer{background:linear-gradient(90deg,#111 25%,#1a1a1a 50%,#111 75%);background-size:200% 100%;animation:shimmer 1.8s infinite}
        .rec-tab{padding:8px 18px;border-radius:100px;border:1px solid #1e1e1e;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.18s;white-space:nowrap;letter-spacing:0.3px}
        .rec-tab.on{background:#c8b99a;color:#080808;border-color:#c8b99a;font-weight:600}
        .rec-tab.off{background:transparent;color:#555}
        .rec-tab.off:hover{border-color:#2a2a2a;color:#aaa}
        .lb-tab{flex:1;padding:9px;border-radius:7px;border:none;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.18s;letter-spacing:0.2px}
        .lb-tab.on{background:#1a1a1a;color:#f0ede8}
        .lb-tab.off{background:transparent;color:#444}
        .lb-tab.off:hover{color:#777}
        .sp-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px;border-radius:12px;border:none;background:#1DB954;color:#000;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:all 0.22s;letter-spacing:0.3px}
        .sp-btn:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(29,185,84,0.3)}
        .sp-btn:active{transform:scale(0.97)}
        .logout-btn{background:none;border:1px solid #1a1a1a;border-radius:8px;padding:7px 12px;color:#555;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:12px;font-family:inherit;transition:all 0.18s}
        .logout-btn:hover{border-color:#2a2a2a;color:#aaa}
        .section-label{font-size:9px;letter-spacing:5px;color:#3a3020;text-transform:uppercase;margin-bottom:6px;font-weight:500}
        @media(max-width:820px){.rl{flex-direction:column!important}.ss{width:100%!important}}
        @media(max-width:480px){.rec-tabs{flex-wrap:wrap!important}}
      `}</style>

      {/* ═══ LANDING ═══ */}
      {screen==="landing"&&(
        <div className="fade-in" style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",background:"radial-gradient(ellipse at 50% 0%,rgba(200,185,154,0.07) 0%,transparent 60%),#080808"}}>
          <div style={{textAlign:"center",marginBottom:"52px",maxWidth:"520px"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:"32px"}}><SoniqLogo size={52}/></div>
            <p style={{fontSize:"clamp(15px,2.5vw,18px)",color:"#777",lineHeight:1.8,marginBottom:"32px",fontWeight:300}}>Your music taste, dissected, scored,<br/>and ranked against the world.</p>
            <div style={{width:"40px",height:"1px",background:"linear-gradient(90deg,transparent,#3a2a0e,transparent)",margin:"0 auto"}}/>
          </div>

          <div style={{width:"100%",maxWidth:"420px",background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:"20px",padding:"32px",boxShadow:"0 40px 80px rgba(0,0,0,0.6),inset 0 1px 0 rgba(200,185,154,0.06)"}}>
            <h2 style={{fontSize:"20px",fontWeight:600,color:"#f0ede8",marginBottom:"6px",letterSpacing:"-0.3px"}}>Connect your music</h2>
            <p style={{fontSize:"13px",color:"#666",marginBottom:"24px",lineHeight:1.7}}>We'll analyse your listening history to calculate your taste score and find your next obsession.</p>

            {error&&<div style={{background:"#120808",border:"1px solid #3a1010",borderRadius:"9px",padding:"12px 14px",fontSize:"12px",color:"#e05555",marginBottom:"16px",lineHeight:1.6}}>{error}</div>}

            <button className="sp-btn" onClick={loginWithSpotify}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              Continue with Spotify
            </button>

            <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 16px",borderRadius:"12px",border:"1px solid #141414",background:"#0a0a0a",marginTop:"10px",cursor:"not-allowed",opacity:0.5}}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{color:"#444",flexShrink:0}}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              <span style={{fontSize:"13px",color:"#444",flex:1}}>Continue with Apple Music</span>
              <span style={{fontSize:"9px",color:"#333",letterSpacing:"1.5px",background:"#111",padding:"3px 8px",borderRadius:"100px",fontWeight:500}}>COMING SOON</span>
            </div>
            <p style={{fontSize:"11px",color:"#2a2a2a",marginTop:"12px",lineHeight:1.7,textAlign:"center"}}>Apple Music integration is restricted by Apple's MusicKit JS restrictions. Working on it.</p>
          </div>

          <div style={{display:"flex",gap:"7px",marginTop:"32px",flexWrap:"wrap",justifyContent:"center"}}>
            {["Taste Score","Genre Analysis","AI Recommendations","Global Leaderboard","Country Rankings"].map(f=>(
              <span key={f} style={{padding:"5px 13px",borderRadius:"100px",background:"#0c0c0c",border:"1px solid #141414",fontSize:"11px",color:"#444",letterSpacing:"0.3px"}}>{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ANALYZING ═══ */}
      {screen==="analyzing"&&(
        <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px"}}>
          <SoniqLogo size={44}/>
          <div style={{display:"flex",gap:"6px",alignItems:"flex-end",height:"52px",margin:"48px 0 36px"}}>
            {[12,20,28,22,14].map((h,i)=>(
              <div key={i} style={{width:"5px",borderRadius:"3px",background:"#c8b99a",height:h+"px",transformOrigin:"bottom",animation:`waveBar 1.1s ease ${i*0.11}s infinite`}}/>
            ))}
          </div>
          <p style={{fontSize:"18px",fontWeight:400,color:"#c8b99a",marginBottom:"8px",animation:"pulse 2s ease infinite",textAlign:"center",letterSpacing:"-0.2px"}}>{STEPS[step]}</p>
          <p style={{fontSize:"10px",color:"#3a3020",letterSpacing:"4px",textTransform:"uppercase",marginBottom:"32px",fontWeight:500}}>Step {step+1} of {STEPS.length}</p>
          <div style={{width:"200px",height:"2px",background:"#111",borderRadius:"1px",overflow:"hidden"}}>
            <div style={{height:"100%",background:"linear-gradient(90deg,#4a3010,#c8b99a)",borderRadius:"1px",transition:"width 1.1s ease",width:Math.round((step+1)/STEPS.length*100)+"%"}}/>
          </div>
        </div>
      )}

      {/* ═══ RESULTS ═══ */}
      {screen==="results"&&profile&&analysis&&recs&&score!==null&&(
        <div style={{maxWidth:"1120px",margin:"0 auto",padding:"24px 20px 80px"}}>

          {/* Nav */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"36px",paddingBottom:"18px",borderBottom:"1px solid #111"}}>
            <SoniqLogo size={30}/>
            <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
              {profile.images?.[0]?.url&&<img src={profile.images[0].url} alt="" style={{width:"34px",height:"34px",borderRadius:"50%",objectFit:"cover",border:"1px solid #222"}}/>}
              <span style={{fontSize:"13px",color:"#666",maxWidth:"140px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{profile.display_name}</span>
              <button className="logout-btn" onClick={logout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="12" height="12"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign out
              </button>
            </div>
          </div>

          <div className="rl" style={{display:"flex",gap:"20px",alignItems:"flex-start"}}>

            {/* ── Left column ── */}
            <div className="ss" style={{width:"300px",flexShrink:0,display:"flex",flexDirection:"column",gap:"14px"}}>

              {/* Score card */}
              <div className="su" style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:"18px",padding:"30px",textAlign:"center"}}>
                <div className="section-label" style={{marginBottom:"22px"}}>Taste Score</div>
                <div style={{display:"flex",justifyContent:"center",marginBottom:"22px"}}><ScoreRing score={score} size={180}/></div>
                {recs.tastePersonality&&(
                  <div style={{display:"inline-block",padding:"5px 15px",borderRadius:"100px",background:"#131210",border:"1px solid #c8b99a22",fontSize:"11px",color:"#c8b99a",letterSpacing:"1.5px",marginBottom:"14px",fontWeight:500}}>{recs.tastePersonality}</div>
                )}
                {recs.tasteReview&&<p style={{fontSize:"13px",color:"#888",lineHeight:1.75,fontStyle:"italic"}}>{recs.tasteReview}</p>}
              </div>

              {/* Score breakdown */}
              <div className="su" style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:"18px",padding:"22px",animationDelay:"0.07s"}}>
                <div className="section-label">Score Breakdown</div>
                {[["Genre Diversity",35],["Obscurity Index",30],["Artist Depth",20],["Era Spread",15]].map(([l,v])=>(
                  <div key={l} style={{marginBottom:"13px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                      <span style={{fontSize:"12px",color:"#888"}}>{l}</span>
                      <span style={{fontSize:"10px",color:"#444"}}>/{v} pts</span>
                    </div>
                    <div style={{height:"2px",background:"#111",borderRadius:"1px",overflow:"hidden"}}>
                      <div style={{height:"100%",background:"linear-gradient(90deg,#3a2808,#c8b99a)",borderRadius:"1px",width:"80%",opacity:0.55}}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Genres */}
              <div className="su" style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:"18px",padding:"22px",animationDelay:"0.13s"}}>
                <div className="section-label">Your Genres</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                  {analysis.topGenres.map((g,i)=>(
                    <span key={g} style={{padding:"5px 12px",borderRadius:"100px",background:"#0a0a0a",border:"1px solid #1a1a1a",fontSize:"11px",color:`rgba(200,185,154,${Math.max(0.3,1-i*0.065)})`,fontWeight:400,letterSpacing:"0.2px"}}>{g}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Right column ── */}
            <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:"14px"}}>

              {/* Recommendations */}
              <div className="su" style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:"18px",padding:"26px",animationDelay:"0.03s"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"22px",flexWrap:"wrap",gap:"12px"}}>
                  <div>
                    <div className="section-label">AI Curated</div>
                    <h2 style={{fontSize:"22px",fontWeight:600,color:"#f0ede8",letterSpacing:"-0.3px"}}>Your Next Obsessions</h2>
                  </div>
                  <div className="rec-tabs" style={{display:"flex",gap:"6px"}}>
                    {["artists","albums","tracks"].map(t=>(
                      <button key={t} className={`rec-tab ${activeTab===t?"on":"off"}`} onClick={()=>setActiveTab(t)} style={{textTransform:"capitalize"}}>{t}</button>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                  {(recs[activeTab]||[]).map((item,i)=><RecCard key={i} item={item} type={activeTab} index={i}/>)}
                </div>
              </div>

              {/* Leaderboard */}
              <div className="su" style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:"18px",padding:"26px",animationDelay:"0.08s"}}>
                <div style={{marginBottom:"20px"}}>
                  <div className="section-label">Rankings</div>
                  <h2 style={{fontSize:"22px",fontWeight:600,color:"#f0ede8",letterSpacing:"-0.3px",marginBottom:"16px"}}>Leaderboard</h2>
                  <div style={{display:"flex",gap:"3px",background:"#060606",padding:"4px",borderRadius:"10px",border:"1px solid #111"}}>
                    {["global","region","country"].map(t=>(
                      <button key={t} className={`lb-tab ${lbTab===t?"on":"off"}`} onClick={()=>switchLbTab(t)}>
                        {t==="region"?(REGION_MAP[profile?.country]||"Region"):t==="country"?(COUNTRY_NAMES[profile?.country]||"Country"):"Global"}
                      </button>
                    ))}
                  </div>
                </div>

                {userRank&&(
                  <div style={{background:"#100f0a",border:"1px solid #c8b99a1a",borderRadius:"10px",padding:"11px 16px",marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:"12px",color:"#6a5030"}}>Your rank on this leaderboard</span>
                    <span style={{fontSize:"22px",fontWeight:700,color:"#c8b99a",letterSpacing:"-0.5px"}}>#{userRank}</span>
                  </div>
                )}

                {lbLoading?(
                  <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                    {[1,2,3,4,5].map(i=><div key={i} className="shimmer" style={{height:"54px",borderRadius:"10px"}}/>)}
                  </div>
                ):leaderboard.length===0?(
                  <div style={{textAlign:"center",padding:"44px 0",fontSize:"13px",color:"#333"}}>No scores yet — be the first!</div>
                ):(
                  <div style={{maxHeight:"420px",overflowY:"auto"}}>
                    {leaderboard.map((e,i)=><LbRow key={e.id||i} entry={e} rank={i+1} isUser={e.spotify_id===profile?.id}/>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
