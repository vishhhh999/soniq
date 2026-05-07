import { useState, useEffect } from "react";

const REDIRECT_URI = typeof window !== "undefined" ? window.location.origin + "/callback" : "";
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

function calcScore(artists, tracks, genres) {
  const genreScore    = Math.min(35, Math.round((new Set(genres).size / 20) * 35));
  const avgPop        = artists.reduce((s,a)=>s+(a.popularity||50),0) / Math.max(artists.length,1);
  const obscScore     = Math.round(((100-avgPop)/100)*30);
  const depthScore    = Math.min(20, Math.round((artists.length/50)*20));
  const years         = tracks.map(t=>t.album?.release_date?parseInt(t.album.release_date):null).filter(Boolean);
  const eraScore      = years.length>1 ? Math.min(15,Math.round(((Math.max(...years)-Math.min(...years))/60)*15)) : 0;
  return Math.min(100, genreScore+obscScore+depthScore+eraScore);
}

function scoreColor(s) {
  if(s>=80) return "#4ade80"; if(s>=60) return "#c8b99a"; if(s>=40) return "#f59e0b"; return "#e05555";
}
function scoreLabel(s) {
  if(s>=85) return "Connoisseur"; if(s>=70) return "Curator"; if(s>=55) return "Explorer"; if(s>=40) return "Mainstream"; return "Casual";
}

function genVerifier() {
  const a=new Uint8Array(32); window.crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
async function genChallenge(v) {
  const d=await window.crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
async function spFetch(ep,token) {
  const r=await fetch("https://api.spotify.com/v1"+ep,{headers:{Authorization:"Bearer "+token}});
  if(!r.ok) throw new Error("Spotify "+r.status);
  return r.json();
}

function SoniqLogo({size=32}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="10" fill="#080808" stroke="#c8b99a" strokeWidth="1.2"/>
        <rect x="5"  y="22" width="4" height="5"  rx="2" fill="#c8b99a" opacity="0.3"/>
        <rect x="11" y="17" width="4" height="14" rx="2" fill="#c8b99a" opacity="0.55"/>
        <rect x="17" y="10" width="4" height="21" rx="2" fill="#c8b99a"/>
        <rect x="23" y="14" width="4" height="17" rx="2" fill="#c8b99a" opacity="0.72"/>
        <rect x="29" y="19" width="4" height="8"  rx="2" fill="#c8b99a" opacity="0.38"/>
        <line x1="5" y1="33" x2="33" y2="33" stroke="#c8b99a" strokeWidth="0.6" opacity="0.2"/>
      </svg>
      <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:size*0.68+"px",fontWeight:700,letterSpacing:"4px",background:"linear-gradient(135deg,#7a5e18,#c8b99a,#f0ede8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>SONIQ</span>
    </div>
  );
}

function ScoreRing({score,size=152}) {
  const r=(size-14)/2, circ=2*Math.PI*r, offset=circ-(score/100)*circ, color=scoreColor(score);
  return (
    <div style={{position:"relative",width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width={size} height={size} style={{position:"absolute",transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#141414" strokeWidth="7"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 1.6s cubic-bezier(0.16,1,0.3,1)",filter:`drop-shadow(0 0 10px ${color}55)`}}/>
      </svg>
      <div style={{textAlign:"center",zIndex:1}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:size*0.27+"px",fontWeight:700,color,lineHeight:1}}>{score}</div>
        <div style={{fontSize:"9px",color:"#4a3a20",letterSpacing:"2px",textTransform:"uppercase",marginTop:"5px"}}>{scoreLabel(score)}</div>
      </div>
    </div>
  );
}

function RecCard({item,type,index}) {
  return (
    <div style={{background:"#0a0a0a",border:"1px solid #141414",borderRadius:"11px",padding:"13px 15px",display:"flex",gap:"12px",alignItems:"flex-start",animation:`fi 0.4s ease ${index*0.06}s both`}}>
      <div style={{width:"30px",height:"30px",borderRadius:"7px",background:"#111",border:"1px solid #1e1e1e",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"13px",fontWeight:600,color:"#c8b99a"}}>{index+1}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:"13px",fontWeight:600,color:"#e8e0d0",marginBottom:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{type==="artists"?item.name:item.title}</div>
        <div style={{fontSize:"10px",color:"#444",marginBottom:"5px"}}>{type==="artists"?item.genre:type==="albums"?item.artist+" · "+item.year:item.artist}</div>
        <div style={{fontSize:"11px",color:"#5a4a2a",lineHeight:1.55}}>{item.why}</div>
      </div>
    </div>
  );
}

function LbRow({entry,rank,isUser}) {
  const medal=rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":null;
  return (
    <div style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 13px",borderRadius:"9px",background:isUser?"#131108":"#080808",border:`1px solid ${isUser?"#c8b99a22":"#111"}`,marginBottom:"5px"}}>
      <div style={{width:"26px",textAlign:"center",fontSize:medal?"15px":"11px",color:medal?"#f0ede8":"#333",fontWeight:600,fontFamily:"'Cormorant Garamond',serif",flexShrink:0}}>{medal||rank}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:"12px",fontWeight:500,color:isUser?"#c8b99a":"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {entry.display_name||"Anonymous"}
          {isUser&&<span style={{fontSize:"9px",color:"#5a4a20",marginLeft:"8px",letterSpacing:"1.5px"}}>YOU</span>}
        </div>
        <div style={{fontSize:"9px",color:"#2a2010",marginTop:"1px"}}>{COUNTRY_NAMES[entry.country]||entry.country||"Unknown"}</div>
      </div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"19px",fontWeight:600,color:scoreColor(entry.score),flexShrink:0}}>{entry.score}</div>
    </div>
  );
}

const STEPS=["Connecting to Spotify…","Reading your listening history…","Analysing genre diversity…","Calculating obscurity index…","Consulting the taste oracle…","Generating recommendations…","Saving your score…","Finalising…"];

export default function App() {
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
    if(!code) return;
    window.history.replaceState({},"","/");
    const verifier=sessionStorage.getItem("pkce_verifier");
    if(!verifier) return;
    (async()=>{
      try {
        const r=await fetch("/api/spotify-token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,verifier,redirectUri:window.location.origin+"/callback"})});
        const d=await r.json();
        if(d.access_token){setToken(d.access_token);sessionStorage.setItem("sp_token",d.access_token);}
        else setError("Spotify auth failed — please try again.");
      } catch(e){setError("Connection error.");}
    })();
  },[]);

  useEffect(()=>{
    const t=sessionStorage.getItem("sp_token");
    if(t) setToken(t);
  },[]);

  useEffect(()=>{
    if(token&&screen==="landing") runAnalysis(token);
  },[token]);

  async function loginWithSpotify() {
    const verifier=genVerifier(), challenge=await genChallenge(verifier);
    sessionStorage.setItem("pkce_verifier",verifier);
    window.location.href="https://accounts.spotify.com/authorize?"+new URLSearchParams({
      client_id:import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      response_type:"code",redirect_uri:window.location.origin+"/callback",
      code_challenge_method:"S256",code_challenge:challenge,scope:SCOPES,
    });
  }

  async function runAnalysis(t) {
    setScreen("analyzing"); let si=0;
    const tick=setInterval(()=>{si=Math.min(si+1,STEPS.length-1);setStep(si);},1100);
    try {
      const [prof,aS,aM,tS]=await Promise.all([
        spFetch("/me",t),
        spFetch("/me/top/artists?limit=50&time_range=short_term",t),
        spFetch("/me/top/artists?limit=50&time_range=medium_term",t),
        spFetch("/me/top/tracks?limit=50&time_range=medium_term",t),
      ]);
      setProfile(prof);
      const allA=Array.from(new Map([...aS.items,...aM.items].map(a=>[a.id,a])).values());
      const genres=allA.flatMap(a=>a.genres), tracks=tS.items;
      const s=calcScore(allA,tracks,genres); setScore(s);
      const gf={}; genres.forEach(g=>{gf[g]=(gf[g]||0)+1;});
      const topGenres=Object.entries(gf).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([g])=>g);
      const data={topArtists:allA.slice(0,10),topTracks:tracks.slice(0,5),topGenres};
      setAnalysis(data);
      clearInterval(tick); setStep(5);
      const r=await getRecommendations(data,s); setRecs(r);
      setStep(6);
      const region=REGION_MAP[prof.country]||"OTHER";
      await fetch("/api/supabase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"upsert",data:{spotify_id:prof.id,display_name:prof.display_name,country:prof.country,region,score:s,genres:topGenres,top_artists:allA.slice(0,5).map(a=>a.name)}})});
      setStep(7);
      await loadLeaderboard("global",prof);
      setScreen("results");
    } catch(e) { clearInterval(tick); setError(e.message); setScreen("landing"); }
  }

  async function getRecommendations(data,s) {
    const prompt=`You are a world-class music curator.\n\nListener taste profile:\n- Top genres: ${data.topGenres.join(", ")}\n- Top artists: ${data.topArtists.slice(0,5).map(a=>a.name).join(", ")}\n- Taste score: ${s}/100\n\nRecommend music they'd love but likely haven't discovered. Push slightly outside comfort zone but stay connected. Be specific and genuine.\n\nRespond ONLY with valid JSON (no markdown):\n{"artists":[{"name":"","genre":"","why":""}],"albums":[{"title":"","artist":"","year":0,"why":""}],"tracks":[{"title":"","artist":"","why":""}],"tasteReview":"2-3 sentence poetic review","tastePersonality":"Two-word descriptor"}\n\nExactly 5 items per array.`;
    const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1500,messages:[{role:"user",content:prompt}]})});
    const d=await r.json();
    return JSON.parse((d.content?.[0]?.text||"").replace(/```json|```/g,"").trim());
  }

  async function loadLeaderboard(tab,prof) {
    setLbLoading(true);
    try {
      const p=prof||profile;
      const filter=tab==="global"?{}:tab==="region"?{region:REGION_MAP[p?.country]||"OTHER"}:{country:p?.country};
      const r=await fetch("/api/supabase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"leaderboard",filter})});
      const d=await r.json(); const rows=d.data||[];
      setLeaderboard(rows);
      if(p){const rank=rows.findIndex(r=>r.spotify_id===p.id);setUserRank(rank>=0?rank+1:null);}
    } catch(e){console.error(e);}
    setLbLoading(false);
  }

  function switchLbTab(t){setLbTab(t);loadLeaderboard(t,profile);}
  function logout(){sessionStorage.removeItem("sp_token");sessionStorage.removeItem("pkce_verifier");setToken(null);setProfile(null);setAnalysis(null);setRecs(null);setScore(null);setLeaderboard([]);setUserRank(null);setScreen("landing");}

  return (
    <div style={{minHeight:"100vh",background:"#080808",color:"#f0ede8",fontFamily:"'DM Sans',sans-serif",overflowX:"hidden"}}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap"/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:#c8b99a22}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:2px}
        @keyframes fi{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes su{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:0.35}50%{opacity:1}}
        @keyframes waveBar{0%,100%{transform:scaleY(0.25)}50%{transform:scaleY(1)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .fade-in{animation:fi 0.5s ease forwards}
        .su{animation:su 0.5s cubic-bezier(0.16,1,0.3,1) forwards}
        .shimmer{background:linear-gradient(90deg,#0e0e0e 25%,#161616 50%,#0e0e0e 75%);background-size:200% 100%;animation:shimmer 1.8s infinite}
        .rec-tab{padding:7px 16px;border-radius:100px;border:1px solid #1a1a1a;font-family:inherit;font-size:11px;font-weight:500;cursor:pointer;transition:all 0.18s;white-space:nowrap;letter-spacing:0.5px}
        .rec-tab.on{background:#c8b99a;color:#080808;border-color:#c8b99a}
        .rec-tab.off{background:transparent;color:#444}
        .rec-tab.off:hover{border-color:#2a2a2a;color:#888}
        .lb-tab{flex:1;padding:8px;border-radius:7px;border:none;font-family:inherit;font-size:11px;font-weight:500;cursor:pointer;transition:all 0.18s;letter-spacing:0.3px}
        .lb-tab.on{background:#161616;color:#f0ede8}
        .lb-tab.off{background:transparent;color:#333}
        .lb-tab.off:hover{color:#666}
        .sp-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:15px;border-radius:12px;border:none;background:#1DB954;color:#000;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.22s;letter-spacing:0.5px}
        .sp-btn:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(29,185,84,0.28)}
        .sp-btn:active{transform:scale(0.97)}
        .logout-btn{background:none;border:1px solid #161616;border-radius:7px;padding:6px 10px;color:#333;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:11px;font-family:inherit;transition:all 0.18s}
        .logout-btn:hover{border-color:#2a2a2a;color:#888}
        @media(max-width:780px){.rl{flex-direction:column!important}.ss{width:100%!important}}
      `}</style>

      {/* ═══ LANDING ═══ */}
      {screen==="landing"&&(
        <div className="fade-in" style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",background:"radial-gradient(ellipse at 50% -10%,rgba(200,185,154,0.06) 0%,transparent 55%),#080808"}}>
          <div style={{textAlign:"center",marginBottom:"44px",maxWidth:"480px"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:"28px"}}><SoniqLogo size={48}/></div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(14px,2.5vw,18px)",fontStyle:"italic",color:"#4a3820",lineHeight:1.8,marginBottom:"28px"}}>Your music taste, dissected, scored,<br/>and ranked against the world.</p>
            <div style={{width:"50px",height:"1px",background:"linear-gradient(90deg,transparent,#4a3010,transparent)",margin:"0 auto"}}/>
          </div>

          <div style={{width:"100%",maxWidth:"390px",background:"#0c0c0c",border:"1px solid #141414",borderRadius:"20px",padding:"30px",boxShadow:"0 40px 80px rgba(0,0,0,0.5),inset 0 1px 0 rgba(200,185,154,0.05)"}}>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"21px",fontWeight:600,color:"#c8b99a",marginBottom:"5px"}}>Connect your music</h2>
            <p style={{fontSize:"11px",color:"#2a2010",marginBottom:"22px",lineHeight:1.7,letterSpacing:"0.3px"}}>We'll analyse your listening history to calculate your taste score and find your next obsession.</p>

            {error&&<div style={{background:"#120808",border:"1px solid #3a1010",borderRadius:"9px",padding:"10px 13px",fontSize:"11px",color:"#e05555",marginBottom:"14px",lineHeight:1.6}}>{error}</div>}

            <button className="sp-btn" onClick={loginWithSpotify}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              Continue with Spotify
            </button>

            <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"13px 15px",borderRadius:"12px",border:"1px solid #111",background:"#0a0a0a",marginTop:"10px",cursor:"not-allowed"}}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" style={{color:"#2a2a2a"}}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              <span style={{fontSize:"12px",color:"#222",flex:1}}>Continue with Apple Music</span>
              <span style={{fontSize:"9px",color:"#1a1a10",letterSpacing:"1.5px",background:"#111",padding:"3px 7px",borderRadius:"100px"}}>COMING SOON</span>
            </div>
            <p style={{fontSize:"10px",color:"#1e1a10",marginTop:"12px",lineHeight:1.65,textAlign:"center"}}>Apple Music integration is restricted by Apple's MusicKit JS. Working on it.</p>
          </div>

          <div style={{display:"flex",gap:"6px",marginTop:"28px",flexWrap:"wrap",justifyContent:"center"}}>
            {["Taste Score","Genre Analysis","AI Recommendations","Global Leaderboard","Country Rankings"].map(f=>(
              <span key={f} style={{padding:"4px 11px",borderRadius:"100px",background:"#0a0a0a",border:"1px solid #111",fontSize:"10px",color:"#2a2010",letterSpacing:"0.5px"}}>{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ANALYZING ═══ */}
      {screen==="analyzing"&&(
        <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px"}}>
          <SoniqLogo size={40}/>
          <div style={{display:"flex",gap:"5px",alignItems:"flex-end",height:"44px",margin:"44px 0 32px"}}>
            {[10,16,24,18,12].map((h,i)=>(
              <div key={i} style={{width:"5px",borderRadius:"3px",background:"#c8b99a",height:h+"px",transformOrigin:"bottom",animation:`waveBar 1.1s ease ${i*0.11}s infinite`}}/>
            ))}
          </div>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"19px",color:"#c8b99a",marginBottom:"8px",animation:"pulse 2s ease infinite",textAlign:"center"}}>{STEPS[step]}</p>
          <p style={{fontSize:"10px",color:"#2a2010",letterSpacing:"3px",textTransform:"uppercase",marginBottom:"28px"}}>Step {step+1} of {STEPS.length}</p>
          <div style={{width:"180px",height:"2px",background:"#0e0e0e",borderRadius:"1px",overflow:"hidden"}}>
            <div style={{height:"100%",background:"linear-gradient(90deg,#4a3010,#c8b99a)",borderRadius:"1px",transition:"width 1s ease",width:Math.round((step+1)/STEPS.length*100)+"%"}}/>
          </div>
        </div>
      )}

      {/* ═══ RESULTS ═══ */}
      {screen==="results"&&profile&&analysis&&recs&&score!==null&&(
        <div style={{maxWidth:"1080px",margin:"0 auto",padding:"18px 16px 60px"}}>

          {/* Nav */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"28px",paddingBottom:"14px",borderBottom:"1px solid #0e0e0e"}}>
            <SoniqLogo size={26}/>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              {profile.images?.[0]?.url&&<img src={profile.images[0].url} alt="" style={{width:"30px",height:"30px",borderRadius:"50%",objectFit:"cover",border:"1px solid #1e1e1e"}}/>}
              <span style={{fontSize:"12px",color:"#555",maxWidth:"120px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{profile.display_name}</span>
              <button className="logout-btn" onClick={logout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign out
              </button>
            </div>
          </div>

          <div className="rl" style={{display:"flex",gap:"16px",alignItems:"flex-start"}}>

            {/* Left */}
            <div className="ss" style={{width:"280px",flexShrink:0,display:"flex",flexDirection:"column",gap:"12px"}}>

              {/* Score */}
              <div className="su" style={{background:"#0c0c0c",border:"1px solid #141414",borderRadius:"16px",padding:"26px",textAlign:"center"}}>
                <div style={{fontSize:"8px",letterSpacing:"5px",color:"#2a2010",textTransform:"uppercase",marginBottom:"18px"}}>Taste Score</div>
                <div style={{display:"flex",justifyContent:"center",marginBottom:"18px"}}><ScoreRing score={score} size={148}/></div>
                {recs.tastePersonality&&<div style={{display:"inline-block",padding:"4px 13px",borderRadius:"100px",background:"#111",border:"1px solid #c8b99a1a",fontSize:"10px",color:"#c8b99a",letterSpacing:"1px",marginBottom:"12px"}}>{recs.tastePersonality}</div>}
                {recs.tasteReview&&<p style={{fontSize:"11px",color:"#4a3820",lineHeight:1.75,fontStyle:"italic"}}>{recs.tasteReview}</p>}
              </div>

              {/* Breakdown */}
              <div className="su" style={{background:"#0c0c0c",border:"1px solid #141414",borderRadius:"16px",padding:"18px",animationDelay:"0.08s"}}>
                <div style={{fontSize:"8px",letterSpacing:"5px",color:"#2a2010",textTransform:"uppercase",marginBottom:"14px"}}>Score Breakdown</div>
                {[["Genre Diversity",35],["Obscurity Index",30],["Artist Depth",20],["Era Spread",15]].map(([l,v])=>(
                  <div key={l} style={{marginBottom:"10px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                      <span style={{fontSize:"10px",color:"#666"}}>{l}</span>
                      <span style={{fontSize:"9px",color:"#2a2010"}}>/{v}pts</span>
                    </div>
                    <div style={{height:"2px",background:"#0e0e0e",borderRadius:"1px",overflow:"hidden"}}>
                      <div style={{height:"100%",background:"linear-gradient(90deg,#3a2808,#c8b99a)",borderRadius:"1px",width:"75%",opacity:0.6}}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Genres */}
              <div className="su" style={{background:"#0c0c0c",border:"1px solid #141414",borderRadius:"16px",padding:"18px",animationDelay:"0.14s"}}>
                <div style={{fontSize:"8px",letterSpacing:"5px",color:"#2a2010",textTransform:"uppercase",marginBottom:"12px"}}>Your Genres</div>
                <div style={{display:"flex",flexWrap:"wrap",margin:"-2px"}}>
                  {analysis.topGenres.map((g,i)=>(
                    <span key={g} style={{display:"inline-block",padding:"4px 10px",borderRadius:"100px",background:"#080808",border:"1px solid #141414",fontSize:"10px",color:`rgba(200,185,154,${Math.max(0.25,1-i*0.07)})`,fontWeight:500,margin:"2px",letterSpacing:"0.3px"}}>{g}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right */}
            <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:"12px"}}>

              {/* Recs */}
              <div className="su" style={{background:"#0c0c0c",border:"1px solid #141414",borderRadius:"16px",padding:"22px",animationDelay:"0.04s"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"18px",flexWrap:"wrap",gap:"10px"}}>
                  <div>
                    <div style={{fontSize:"8px",letterSpacing:"5px",color:"#2a2010",textTransform:"uppercase",marginBottom:"4px"}}>AI Curated</div>
                    <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"21px",fontWeight:600,color:"#c8b99a"}}>Your Next Obsessions</h2>
                  </div>
                  <div style={{display:"flex",gap:"5px",overflowX:"auto"}}>
                    {["artists","albums","tracks"].map(t=>(
                      <button key={t} className={`rec-tab ${activeTab===t?"on":"off"}`} onClick={()=>setActiveTab(t)} style={{textTransform:"capitalize"}}>{t}</button>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"7px"}}>
                  {(recs[activeTab]||[]).map((item,i)=><RecCard key={i} item={item} type={activeTab} index={i}/>)}
                </div>
              </div>

              {/* Leaderboard */}
              <div className="su" style={{background:"#0c0c0c",border:"1px solid #141414",borderRadius:"16px",padding:"22px",animationDelay:"0.09s"}}>
                <div style={{marginBottom:"18px"}}>
                  <div style={{fontSize:"8px",letterSpacing:"5px",color:"#2a2010",textTransform:"uppercase",marginBottom:"4px"}}>Rankings</div>
                  <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"21px",fontWeight:600,color:"#c8b99a",marginBottom:"14px"}}>Leaderboard</h2>
                  <div style={{display:"flex",gap:"3px",background:"#060606",padding:"3px",borderRadius:"9px",border:"1px solid #0e0e0e"}}>
                    {["global","region","country"].map(t=>(
                      <button key={t} className={`lb-tab ${lbTab===t?"on":"off"}`} onClick={()=>switchLbTab(t)}>
                        {t==="region"?(REGION_MAP[profile?.country]||"Region"):t==="country"?(COUNTRY_NAMES[profile?.country]||"Country"):"Global"}
                      </button>
                    ))}
                  </div>
                </div>

                {userRank&&<div style={{background:"#0f0e08",border:"1px solid #c8b99a1a",borderRadius:"9px",padding:"9px 13px",marginBottom:"12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:"11px",color:"#4a3820"}}>Your rank on this leaderboard</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"20px",fontWeight:600,color:"#c8b99a"}}>#{userRank}</span>
                </div>}

                {lbLoading?(
                  <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
                    {[1,2,3,4,5].map(i=><div key={i} className="shimmer" style={{height:"50px",borderRadius:"9px"}}/>)}
                  </div>
                ):leaderboard.length===0?(
                  <div style={{textAlign:"center",padding:"36px 0",fontSize:"12px",color:"#1e1e10"}}>No scores yet. Be the first!</div>
                ):(
                  <div style={{maxHeight:"380px",overflowY:"auto"}}>
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
