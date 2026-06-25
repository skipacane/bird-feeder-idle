/* ============================================================
   sprites.js — PIXEL-ART art & animation for Backyard Birds
   Everything is drawn into a low-res 480x270 buffer using only
   integer pixel blocks (no gradients / no anti-aliased curves),
   then the canvas is scaled up with nearest-neighbour for a
   crisp Stardew-Valley-style look. No external image assets.
   ============================================================ */

const Sprites = (() => {

  /* ---------------- palette helpers ---------------- */
  function shade(hex, amt){              // amt: -1 darken .. +1 lighten
    let c = (hex||"#000").replace('#','');
    if(c.length===3) c = c.split('').map(x=>x+x).join('');
    let r=parseInt(c.slice(0,2),16), g=parseInt(c.slice(2,4),16), b=parseInt(c.slice(4,6),16);
    const tgt = amt<0?0:255, p=Math.abs(amt);
    r=Math.round(r+(tgt-r)*p); g=Math.round(g+(tgt-g)*p); b=Math.round(b+(tgt-b)*p);
    return `rgb(${r},${g},${b})`;
  }

  /* ---------------- pixel primitives ---------------- */
  function px(ctx,x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(x|0,y|0,Math.max(1,Math.round(w)),Math.max(1,Math.round(h))); }
  function dot(ctx,x,y,c){ ctx.fillStyle=c; ctx.fillRect(x|0,y|0,1,1); }
  function pell(ctx,cx,cy,rx,ry,c){      // crisp pixel ellipse (filled)
    cx=Math.round(cx); cy=Math.round(cy); rx=Math.max(0.5,rx); ry=Math.max(0.5,ry);
    ctx.fillStyle=c;
    const ry2=Math.round(ry);
    for(let y=-ry2;y<=ry2;y++){
      const t=1-(y*y)/(ry*ry);
      if(t<0) continue;
      const hw=Math.floor(rx*Math.sqrt(t)+0.001);
      ctx.fillRect(cx-hw, cy+y, hw*2+1, 1);
    }
  }

  /* ---------------- 3x5 pixel font (numbers / + / -) ---------------- */
  const FONT = {
    "0":["111","101","101","101","111"], "1":["010","110","010","010","111"],
    "2":["111","001","111","100","111"], "3":["111","001","111","001","111"],
    "4":["101","101","111","001","001"], "5":["111","100","111","001","111"],
    "6":["111","100","111","101","111"], "7":["111","001","010","010","010"],
    "8":["111","101","111","101","111"], "9":["111","101","111","001","111"],
    "+":["000","010","111","010","000"], "-":["000","000","111","000","000"],
    " ":["000","000","000","000","000"],
    "F":["111","100","111","100","100"], "R":["111","101","111","110","101"],
    "E":["111","100","111","100","111"], "S":["111","100","111","001","111"],
    "H":["101","101","111","101","101"], "!":["010","010","010","000","010"],
    ".":["000","000","000","000","010"], "*":["101","010","111","010","101"],
  };
  function pixelTextWidth(str,scale=1){ return str.length*4*scale - scale; }
  function pixelText(ctx,x,y,str,color,scale=1){
    x=Math.round(x); y=Math.round(y);
    let cx=x;
    ctx.fillStyle=color;
    for(const ch of str){
      const g=FONT[ch]||FONT[" "];
      for(let r=0;r<5;r++) for(let c=0;c<3;c++)
        if(g[r][c]==="1") ctx.fillRect(cx+c*scale, y+r*scale, scale, scale);
      cx+=4*scale;
    }
  }

  /* ---------------- scene layout ---------------- */
  const L = {
    W:480, H:270,
    horizon:150,
    groundContact:236,
    feeder:{ x:240, trayY:152 },
  };

  /* cozy, saturated palette (Stardew-ish) */
  const SKY=["#54b0e6","#77c6ec","#a8ddf0","#d6eff4"];
  const GROUND_HI="#8ec656", GROUND_LO="#5f9c3c", GROUND_DK="#49802f";
  const MTN_B="#9ab9c6", MTN_B_HI="#c2dbe1", MTN_F="#74a394", MTN_F_HI="#a6cdbe";
  const OAK=["#2f6e2c","#54a344","#7cc657","#234f22"];   // dark, mid, light, outline
  const PINE=["#2c7a3f","#3f9450","#63b76d","#1f5a2c"];  // dark, mid, light, outline
  const TRUNK="#7c5a36", TRUNK_DK="#5e4327", TRUNK_HI="#9a7547";
  const FENCE="#c08a4e", FENCE_DK="#8a5f33", FENCE_HI="#dcae72";

  /* deterministic decoration */
  const clouds=[ {x:50,y:24,s:1.2,spd:2.4}, {x:232,y:16,s:1.5,spd:1.8}, {x:382,y:42,s:1.0,spd:3.0}, {x:150,y:56,s:0.8,spd:2.2} ];
  const houses=[
    {x:84,  w:46, h:30, wall:"#cda079", roof:"#a8554a"},
    {x:152, w:38, h:26, wall:"#bfb1c9", roof:"#6c6796"},
    {x:298, w:40, h:28, wall:"#c7cf9e", roof:"#5f8a6e"},
    {x:352, w:48, h:34, wall:"#d3a98c", roof:"#9c5340"},
  ];
  const bgTrees=[
    {x:36,type:"oak",s:1.0}, {x:120,type:"oak",s:0.55},
    {x:436,type:"pine",s:1.12}, {x:464,type:"pine",s:0.74}, {x:266,type:"pine",s:0.42},
  ];
  const flowers=[]; (function(){
    let s=1337; const rnd=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;
    const cols=["#f0d84a","#ef8fb0","#ffffff","#cf8fdc"];
    for(let i=0;i<32;i++) flowers.push({x:Math.round(rnd()*L.W), y:Math.round(L.horizon+18+rnd()*(L.H-L.horizon-24)), c:cols[(rnd()*cols.length)|0]});
  })();
  const grassTufts=[]; (function(){
    let s=99; const rnd=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;
    for(let i=0;i<74;i++) grassTufts.push({x:Math.round(rnd()*L.W), y:Math.round(L.horizon+15+rnd()*(L.H-L.horizon-18)), d:rnd()>0.5});
  })();
  const distantPines=[]; (function(){
    let s=7; const rnd=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;
    for(let i=0;i<24;i++) distantPines.push({x:Math.round(rnd()*L.W), s:0.26+rnd()*0.16});
  })();
  /* per-area decoration (deterministic) */
  function seeded(seed){ let s=seed; return ()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff; }
  const forestTrees=[]; (function(){ const r=seeded(51); for(let i=0;i<14;i++) forestTrees.push({x:Math.round(r()*L.W),dy:2+Math.round(r()*8),s:0.5+r()*0.7,type:r()>0.45?"pine":"oak"}); forestTrees.sort((a,b)=>a.s-b.s); })();
  const forestBushes=[]; (function(){ const r=seeded(77); for(let i=0;i<8;i++) forestBushes.push({x:Math.round(r()*L.W),y:Math.round(L.horizon+18+r()*44),rr:6+r()*6}); })();
  const reeds=[]; (function(){ const r=seeded(33); for(let i=0;i<28;i++) reeds.push({x:Math.round(r()*L.W),dy:18+Math.round(r()*12),h:9+Math.round(r()*13)}); })();
  const lilypads=[]; (function(){ const r=seeded(88); for(let i=0;i<10;i++) lilypads.push({x:Math.round(r()*L.W),y:Math.round(L.horizon+44+r()*(L.H-L.horizon-54))}); })();
  const mtnPines=[]; (function(){ const r=seeded(63); for(let i=0;i<12;i++) mtnPines.push({x:Math.round(r()*L.W),dy:2+Math.round(r()*8),s:0.5+r()*0.8}); })();
  const rocks=[]; (function(){ const r=seeded(44); for(let i=0;i<7;i++) rocks.push({x:Math.round(r()*L.W),dy:14+Math.round(r()*36),s:0.7+r()*0.9}); })();
  const snowPatches=[]; (function(){ const r=seeded(55); for(let i=0;i<10;i++) snowPatches.push({x:Math.round(r()*L.W),y:Math.round(L.horizon+16+r()*(L.H-L.horizon-22)),rr:5+r()*7}); })();

  /* active (season-tinted) foliage palettes */
  let curOak=OAK, curPine=PINE;
  function seasonTheme(season){
    let oak=OAK, pine=PINE, gh=GROUND_HI, gl=GROUND_LO, gd=GROUND_DK, snow=false;
    if(season===0){ oak=OAK.map(c=>shade(c,0.05)); gh=shade(GROUND_HI,0.05); }                       // spring
    else if(season===2){ oak=["#a85f24","#cf8a2e","#e3ab3c","#7c4718"]; gh="#abb756"; gl="#8c9c42"; gd="#717f32"; }  // autumn
    else if(season===3){ oak=OAK.map(c=>shade(c,-0.06)); pine=PINE.map(c=>shade(c,-0.04)); gh="#e9eff3"; gl="#d6dfe6"; gd="#bcc8d1"; snow=true; }  // winter
    return { oak, pine, gh, gl, gd, snow };
  }

  /* ===========================================================
     BACKGROUND
     =========================================================== */
  function drawBackground(ctx, t, env){
    env=env||{};
    const season=env.season||0, area=env.area||"suburb", weather=env.weather||"clear";
    const TH=seasonTheme(season); curOak=TH.oak; curPine=TH.pine;
    const {W,H,horizon}=L;

    drawSky(ctx, weather);
    if(weather!=="rain"){ pell(ctx,64,30,14,14,"#fce9a6"); pell(ctx,64,30,10,10,"#fff6cf"); }
    for(const c of clouds){ const x=Math.round(((c.x+t*c.spd)%(W+90))-45); drawCloud(ctx,x,c.y,c.s, weather!=="clear"); }
    if(weather!=="clear") for(let i=0;i<3;i++){ const c=clouds[i]; const x=Math.round(((c.x+150+t*c.spd*0.7)%(W+90))-45); drawCloud(ctx,x,c.y+26,c.s*0.85,true); }

    drawMountains(ctx, area, TH);
    px(ctx,0,horizon,W,7,TH.gh); px(ctx,0,horizon+7,W,H-horizon-7,TH.gl); px(ctx,0,horizon,W,1,TH.gd);

    if(area==="forest") sceneForest(ctx,TH);
    else if(area==="wetland") sceneWetland(ctx,TH,t);
    else if(area==="mountain") sceneMountain(ctx,TH);
    else sceneSuburb(ctx,TH);

    if(area!=="wetland"){ pell(ctx,L.feeder.x,L.groundContact+8,40,9,"#b08f5e"); pell(ctx,L.feeder.x,L.groundContact+8,32,6,"#c4a674"); }

    if(area!=="wetland"){
      for(const g of grassTufts){ px(ctx,g.x,g.y,1,3,TH.gd); px(ctx,g.x+(g.d?1:-1),g.y+1,1,2,shade(TH.gl,-0.22)); dot(ctx,g.x,g.y-1,TH.gh); }
      if(TH.snow) for(const f of flowers){ dot(ctx,f.x,f.y-1,"#ffffff"); }
      else for(const f of flowers){ px(ctx,f.x,f.y+1,1,2,TH.gd); dot(ctx,f.x,f.y,f.c); dot(ctx,f.x+1,f.y,shade(f.c,-0.18)); }
    }
  }

  function drawSky(ctx, weather){
    const {W,horizon}=L;
    let a=[0x46,0xad,0xe8], b=[0xd6,0xef,0xf4];
    if(weather!=="clear"){ a=[0x90,0xa6,0xb4]; b=[0xcb,0xd5,0xd8]; }
    for(let y=0;y<horizon;y++){ const k=y/horizon;
      px(ctx,0,y,W,1,`rgb(${Math.round(a[0]+(b[0]-a[0])*k)},${Math.round(a[1]+(b[1]-a[1])*k)},${Math.round(a[2]+(b[2]-a[2])*k)})`);
    }
  }
  function drawMountains(ctx, area, TH){
    const h=L.horizon;
    if(area==="mountain"){ ridge(ctx,h,88,0.013,0.4,"#86a0b6","#e6eef3"); ridge(ctx,h,60,0.02,2.0,"#6f8fa0","#d4e0e6"); }
    else { ridge(ctx,h,58,0.017,0.6,MTN_B, TH.snow?"#eef4f7":MTN_B_HI); ridge(ctx,h,38,0.025,2.4,MTN_F, TH.snow?"#e6eef2":MTN_F_HI); }
  }
  function sceneSuburb(ctx,TH){
    for(const p of distantPines) drawPine(ctx,p.x,L.horizon+2,p.s);
    for(const hh of houses) drawHouse(ctx,hh,L.horizon);
    for(const tr of bgTrees){ tr.type==="oak"?drawOak(ctx,tr.x,L.horizon+5,tr.s):drawPine(ctx,tr.x,L.horizon+5,tr.s); }
    drawFence(ctx, L.horizon+13);
  }
  function sceneForest(ctx,TH){
    for(const tr of forestTrees){ tr.type==="oak"?drawOak(ctx,tr.x,L.horizon+tr.dy,tr.s):drawPine(ctx,tr.x,L.horizon+tr.dy,tr.s); }
    for(const b of forestBushes){ pell(ctx,b.x,b.y,b.rr+1,b.rr*0.8+1,curOak[3]); pell(ctx,b.x,b.y,b.rr,b.rr*0.8,curOak[1]); pell(ctx,b.x-1,b.y-1,b.rr*0.5,b.rr*0.4,curOak[2]); }
  }
  function sceneWetland(ctx,TH,t){
    const wT=L.horizon+26;
    px(ctx,0,wT,L.W,L.H-wT,"#5a93b0"); px(ctx,0,wT,L.W,2,"#82b8d0");
    for(let i=0;i<5;i++){ const yy=wT+8+i*16, off=Math.round(Math.sin(t*0.6+i)*6);
      px(ctx,40+off,yy,28,1,"#7fb2cb"); px(ctx,210-off,yy+4,40,1,"#6ea6c2"); px(ctx,360+off,yy,24,1,"#7fb2cb"); }
    for(const lp of lilypads){ pell(ctx,lp.x,lp.y,4,2,"#3f8a4f"); dot(ctx,lp.x,lp.y-1,"#e9a0c0"); }
    for(const r of reeds) drawCattail(ctx,r.x,L.horizon+r.dy,r.h);
    drawOak(ctx,50,L.horizon+6,0.64);
  }
  function sceneMountain(ctx,TH){
    for(const p of mtnPines) drawPine(ctx,p.x,L.horizon+p.dy,p.s);
    for(const r of rocks) drawRock(ctx,r.x,L.horizon+r.dy,r.s);
    for(const s of snowPatches) pell(ctx,s.x,s.y,s.rr,s.rr*0.45,"#eef4f7");
  }
  function drawCattail(ctx,x,baseY,h){
    px(ctx,x,baseY-h,1,h,"#5f7d3a");
    px(ctx,x-2,baseY-h+4,2,h-4,"#6f9a44"); px(ctx,x+1,baseY-h+6,2,h-6,"#5f8a3a");
    px(ctx,x-1,baseY-h-5,2,6,"#7a4a26"); dot(ctx,x-1,baseY-h-6,"#8a5a30");
  }
  function drawRock(ctx,x,baseY,s){
    pell(ctx,x,baseY-3*s,8*s,5*s,"#71767c"); pell(ctx,x,baseY-3*s,8*s-1,5*s-1,"#9aa0a6");
    pell(ctx,x-2*s,baseY-5*s,4*s,3*s,"#bcc2c8");
  }

  function ridge(ctx,base,amp,freq,phase,color,cap){
    for(let x=0;x<=L.W;x++){
      let n=0.5+0.34*Math.sin(x*freq+phase)+0.18*Math.sin(x*freq*2.7+phase*1.7)+0.1*Math.sin(x*freq*5.3+phase);
      if(n<0)n=0; if(n>1)n=1;
      const yy=Math.round(base-amp*n);
      ctx.fillStyle=color; ctx.fillRect(x,yy,1,base-yy);
      ctx.fillStyle=cap;   ctx.fillRect(x,yy,1,2);
    }
  }

  function drawCloud(ctx,x,y,s,grey){
    const lobes=[[0,0,10],[11,2,8],[-10,3,7],[5,-5,8],[-3,4,7],[17,4,5]];
    const body=grey?"#e3e8ec":"#ffffff", shadow=grey?"#bcc6cd":"#cfe6f0";
    lobes.forEach(([dx,dy,r])=>pell(ctx,x+dx*s,y+dy*s+2,r*s,r*s*0.8,shadow));
    lobes.forEach(([dx,dy,r])=>pell(ctx,x+dx*s,y+dy*s,r*s,r*s*0.85,body));
    px(ctx,Math.round(x-13*s),Math.round(y+5*s),Math.round(30*s),2,body);
    pell(ctx,x-3*s,y-4*s,5*s,3*s,body);
  }

  function drawHouse(ctx,h,horizon){
    const baseY=horizon, x=h.x, w=h.w, ht=h.h;
    const wallTop=baseY-ht;
    // wall
    px(ctx,x,wallTop,w,ht,h.wall);
    for(let yy=wallTop+4; yy<baseY-1; yy+=4) px(ctx,x,yy,w,1,shade(h.wall,-0.16)); // log courses
    px(ctx,x,wallTop,w,1,shade(h.wall,0.16));            // top highlight
    px(ctx,x,baseY-1,w,1,shade(h.wall,-0.34));           // base shadow
    px(ctx,x,wallTop,1,ht,shade(h.wall,-0.2)); px(ctx,x+w-1,wallTop,1,ht,shade(h.wall,-0.2));

    // peaked shingle roof
    const ov=5, span=w/2+ov, apexH=Math.round(span*0.78);
    for(let i=0;i<=span;i++){
      const colH=Math.round(i/span*apexH);
      ctx.fillStyle=h.roof; ctx.fillRect(x-ov+i, wallTop-colH, 1, colH+2);
      ctx.fillStyle=h.roof; ctx.fillRect(x+w+ov-i, wallTop-colH, 1, colH+2);
    }
    // shingle rows (bands parallel to the eave)
    for(let bnd=1;bnd<=2;bnd++){
      const fy=bnd/3, yy=wallTop-Math.round(apexH*fy), ww=Math.round(span*(1-fy)*2);
      px(ctx,Math.round(x+w/2-ww/2),yy,ww,1,shade(h.roof,-0.2));
    }
    px(ctx,x-ov,wallTop,w+ov*2,1,shade(h.roof,-0.32));   // eave line
    px(ctx,x-1,wallTop-apexH,2,2,shade(h.roof,0.18));    // ridge cap

    // window with cross frame
    const wx=x+Math.round(w*0.16), wy=baseY-Math.round(ht*0.62), wwd=Math.max(6,Math.round(w*0.24)), whd=Math.max(6,Math.round(ht*0.34));
    px(ctx,wx-1,wy-1,wwd+2,whd+2,shade(h.wall,-0.42));
    px(ctx,wx,wy,wwd,whd,"#bfe6f2");
    px(ctx,wx,wy,wwd,Math.ceil(whd/2),"#9fd2e8");
    px(ctx,wx+(wwd>>1),wy,1,whd,shade(h.wall,-0.42)); px(ctx,wx,wy+(whd>>1),wwd,1,shade(h.wall,-0.42));
    // door
    const dxp=x+Math.round(w*0.58), dwd=Math.max(6,Math.round(w*0.22)), dh=Math.round(ht*0.5);
    px(ctx,dxp,baseY-dh,dwd,dh,shade(h.wall,-0.46));
    px(ctx,dxp,baseY-dh,dwd,1,shade(h.wall,-0.6));
    dot(ctx,dxp+dwd-2,baseY-Math.round(dh*0.5),"#f3d98a");
  }

  function drawFence(ctx,y){
    const W=L.W;
    for(const ry of [y-10, y-3]){          // two rails
      px(ctx,0,ry,W,3,FENCE);
      px(ctx,0,ry,W,1,FENCE_HI);
      px(ctx,0,ry+2,W,1,FENCE_DK);
    }
    for(let x=4;x<W;x+=32){                 // posts
      px(ctx,x,y-15,5,21,FENCE);
      px(ctx,x,y-15,1,21,FENCE_HI);
      px(ctx,x+4,y-15,1,21,FENCE_DK);
      px(ctx,x,y-15,5,1,FENCE_HI);
      px(ctx,x,y+6,5,1,"rgba(40,30,18,.22)");
    }
  }

  /* apex-up triangle (for pines / roofs) */
  function tri(ctx,cx,baseY,halfW,height,color){
    ctx.fillStyle=color;
    const denom=Math.max(1,height-1);
    for(let yy=0;yy<height;yy++){
      const w=Math.round(halfW*(yy/denom));
      ctx.fillRect(Math.round(cx-w), baseY-height+yy+1, w*2+1, 1);
    }
  }

  function drawOak(ctx,x,baseY,s){
    const th=Math.round(30*s), tw=Math.max(3,Math.round(5*s));
    px(ctx,x-(tw>>1),baseY-th,tw,th,TRUNK);
    px(ctx,x-(tw>>1),baseY-th,1,th,TRUNK_HI);
    px(ctx,x+(tw>>1)-1,baseY-th,1,th,TRUNK_DK);
    const cy=baseY-th-Math.round(15*s), O=curOak;
    const cl=[[0,2,20],[-15,6,13],[15,5,14],[-9,-8,14],[9,-8,13],[0,-15,13],[-19,-3,10],[19,-2,11]];
    cl.forEach(([dx,dy,r])=>pell(ctx,x+dx*s,cy+dy*s,r*s+1,r*s+1,O[3]));      // outline
    cl.forEach(([dx,dy,r])=>pell(ctx,x+dx*s,cy+dy*s,r*s,r*s,O[1]));          // mid
    cl.forEach(([dx,dy,r])=>{ if(dy>=0) pell(ctx,x+(dx+3)*s,cy+(dy+4)*s,r*0.7*s,r*0.6*s,O[0]); }); // shade
    [[-9,-8,8],[0,-15,8],[-16,-1,6],[6,-12,6]].forEach(([dx,dy,r])=>pell(ctx,x+dx*s,cy+dy*s,r*s,r*s,O[2])); // highlight
    for(let i=0;i<7;i++){ const a=i*1.7; dot(ctx,Math.round(x+Math.cos(a)*13*s),Math.round(cy+Math.sin(a)*11*s),O[3]); }
  }

  function drawPine(ctx,x,baseY,s){
    const tw=Math.max(2,Math.round(3*s));
    px(ctx,x-(tw>>1),baseY-Math.round(7*s),tw,Math.round(7*s),TRUNK);
    const sizes=[[24,18],[19,16],[14,15],[9,13]], P=curPine;
    let cur=baseY-Math.round(5*s);
    sizes.forEach(([hw,h])=>{
      hw=Math.round(hw*s); h=Math.max(3,Math.round(h*s));
      tri(ctx,x,cur,hw+1,h+1,P[3]);                                  // outline
      tri(ctx,x,cur,hw,h,P[1]);                                      // mid
      tri(ctx,x-Math.round(hw*0.28),cur-1,Math.round(hw*0.5),Math.round(h*0.78),P[2]); // sunlit left
      tri(ctx,x+Math.round(hw*0.34),cur,Math.round(hw*0.46),Math.round(h*0.72),P[0]);  // shaded right
      cur-=Math.round(h*0.6);
    });
  }

  /* ===========================================================
     FEEDER
     =========================================================== */
  function drawFeeder(ctx, feeder, t){
    const fx=feeder.x, ty=feeder.trayY;
    const fill = feeder.cap>0 ? Math.max(0,Math.min(1,feeder.food/feeder.cap)) : 0;
    const WOOD="#a4764b", WOOD_DK="#75502f", WOOD_HI="#c59a66";
    const ROOF="#b35a44", ROOF_DK="#8b4030", ROOF_HI="#d3805f";

    // pole (with grain)
    px(ctx,fx-2,ty+8,4,L.groundContact-(ty+8),WOOD);
    px(ctx,fx-2,ty+8,1,L.groundContact-(ty+8),WOOD_HI);
    px(ctx,fx+1,ty+8,1,L.groundContact-(ty+8),WOOD_DK);
    pell(ctx,fx,L.groundContact+4,10,3,"rgba(40,30,18,.25)");

    // perch dowel (through hopper base, sticking out)
    px(ctx,fx-32,ty-2,64,2,WOOD_DK);
    px(ctx,fx-32,ty-2,64,1,WOOD_HI);

    // tray with plank seams
    px(ctx,fx-28,ty,56,8,WOOD_DK);
    px(ctx,fx-27,ty,54,6,WOOD);
    px(ctx,fx-27,ty,54,1,WOOD_HI);
    for(let sx=fx-18; sx<fx+22; sx+=12) px(ctx,sx,ty+1,1,5,WOOD_DK);
    // seed mound
    if(feeder.food>0){
      const w=Math.round(10+34*fill);
      px(ctx,fx-(w>>1),ty-1,w,2,"#cfa75e");
      px(ctx,fx-(w>>1)+1,ty-2,Math.max(1,w-2),1,"#e0bd74");
      for(let i=0;i<(fill*6|0);i++) dot(ctx, fx-(w>>1)+2+i*3, ty-1, "#a87f3e");
    }

    // hopper body (planks + corner posts)
    const hw=28, hh=22, hx=fx-(hw>>1), hyTop=ty-4-hh;
    px(ctx,hx,hyTop,hw,hh,WOOD);
    for(let yy=hyTop+4; yy<ty-4; yy+=5) px(ctx,hx,yy,hw,1,shade(WOOD,-0.18));
    px(ctx,hx,hyTop,2,hh,WOOD_DK); px(ctx,hx+hw-2,hyTop,2,hh,WOOD_DK);
    px(ctx,hx,hyTop,1,hh,WOOD_HI);
    // glass window + seed column
    const gx=hx+5, gy=hyTop+4, gw=hw-10, gh=hh-8;
    px(ctx,gx,gy,gw,gh,"#e9f1ef");
    const colH=Math.round(gh*fill);
    if(colH>0){
      px(ctx,gx,gy+gh-colH,gw,colH,"#cda559");
      px(ctx,gx,gy+gh-colH,gw,1,"#e0bd74");
      for(let i=0;i<3;i++) dot(ctx,gx+2+i*5,gy+gh-2-(i%2),"#9c7636");
    }
    px(ctx,gx,gy,1,gh,"#ffffff");                 // glass shine
    ctx.strokeStyle=WOOD_DK; ctx.lineWidth=1; ctx.strokeRect(gx+0.5,gy+0.5,gw-1,gh-1);

    // shingled roof
    const ov=6, span=hw/2+ov, apexH=Math.round(span*0.85), ridgeY=hyTop-apexH;
    for(let i=0;i<=span;i++){
      const ch=Math.round(i/span*apexH);
      ctx.fillStyle=ROOF; ctx.fillRect(hx-ov+i, hyTop-ch, 1, ch+2);
      ctx.fillStyle=ROOF; ctx.fillRect(hx+hw+ov-i, hyTop-ch, 1, ch+2);
    }
    for(let bnd=1;bnd<=2;bnd++){
      const fy=bnd/3, yy=hyTop-Math.round(apexH*fy), ww=Math.round(span*(1-fy)*2);
      px(ctx,Math.round(fx-ww/2),yy,ww,1,ROOF_DK);
    }
    px(ctx,hx-ov,hyTop,hw+ov*2,1,ROOF_DK);        // eave line
    px(ctx,fx-1,ridgeY,2,3,ROOF_HI);              // ridge cap
  }

  /* perch positions (feet points) — first 5 on/around the feeder, the rest
     are ground-feeding spots used as the "Extra Perch" upgrade adds capacity */
  function perchSlots(feeder, count){
    const fx=feeder.x, ty=feeder.trayY, gc=L.groundContact;
    const all=[
      { x:fx-17, y:ty,    facing: 1 },
      { x:fx+17, y:ty,    facing:-1 },
      { x:fx-25, y:ty-2,  facing: 1 },
      { x:fx+25, y:ty-2,  facing:-1 },
      { x:fx,    y:ty-35, facing: 1 },
      { x:fx-43, y:gc-2,  facing: 1 },
      { x:fx+43, y:gc-2,  facing:-1 },
      { x:fx-60, y:gc-1,  facing: 1 },
      { x:fx+60, y:gc-1,  facing:-1 },
      { x:fx-32, y:gc-1,  facing: 1 },
      { x:fx-78, y:gc,    facing: 1 },
      { x:fx+78, y:gc,    facing:-1 },
      { x:fx+32, y:gc-1,  facing:-1 },
      { x:fx-95, y:gc+1,  facing: 1 },
      { x:fx+95, y:gc+1,  facing:-1 },
      { x:fx-112,y:gc+2,  facing: 1 },
      { x:fx+112,y:gc+2,  facing:-1 },
    ];
    return all.slice(0, Math.max(1, count||5));
  }

  /* ===========================================================
     BIRD  (procedural pixel sprite, facing handled by `dir`)
     o = { x,y, facing, mode:'fly'|'perch', flapPhase, bob, peck,
           emote, emoteFade, silhouette }
     (x,y) = body centre.  Feet sit standHeight() below.
     =========================================================== */
  function metrics(sp){
    const sh=sp.shape, sz=sh.size||1;
    let rx=Math.round(6*sz), ry=Math.round(5*sz);
    if(sh.plump){ rx+=1; ry+=1; }
    if(sh.little){ rx=Math.max(4,rx-1); ry=Math.max(3,ry-1); }
    const hr=Math.max(3,Math.round(3.3*sz));
    const legLen=Math.max(2,Math.round(3*sz));
    return {rx,ry,hr,legLen,sz};
  }
  function standHeight(sp){ const m=metrics(sp); return m.ry + m.legLen; }

  function drawBird(ctx, sp, o){
    const P=sp.palette, sh=sp.shape;
    const dir=(o.facing||1)>=0?1:-1;
    const sil=o.silhouette;
    const col=k=> sil || P[k] || P.body;
    const OUT = sil ? shade(sil,-0.25) : shade(P.body,-0.5);
    const {rx,ry,hr,legLen}=metrics(sp);

    const bx=Math.round(o.x), by=Math.round(o.y+(o.bob||0));
    const peckDip=Math.round((o.peck||0)*2);
    const hx=bx+dir*Math.round(rx*0.55+1);
    const hy=by-Math.round(ry*0.55)-1+peckDip;
    const flying=o.mode==="fly";
    const flap=Math.sin(o.flapPhase||0);

    /* ---- ground shadow (perched) ---- */
    if(!flying && !o.noShadow) pell(ctx,bx,by+ry+legLen,rx,2,"rgba(40,30,18,.18)");

    /* ---- tail ---- */
    const tailLen = Math.round((sh.longTail?2.0:1.1)*rx);
    drawTail(ctx,bx-dir*(rx-1),by-1,-dir,tailLen,sh.longTail,col("tail"),OUT,sil);

    /* ---- far wing (flight) ---- */
    if(flying) drawWing(ctx,bx,by,dir,rx,ry,Math.round(-flap*3),shade(col("wing"),-0.12),OUT,sil,true);

    /* ---- legs (perched) ---- */
    if(!flying){
      const legC = sil||P.legs||"#caa24a";
      for(const lx of [bx-dir, bx+dir*Math.round(rx*0.4)]){
        px(ctx,lx,by+ry-1,1,legLen,legC);
        dot(ctx,lx+dir,by+ry-1+legLen,legC);
      }
    }

    /* ---- silhouette + body ---- */
    pell(ctx,bx,by,rx+1,ry+1,OUT);                 // body outline
    pell(ctx,hx,hy,hr+1,hr+1,OUT);                 // head outline
    pell(ctx,bx,by,rx,ry,col("body"));             // body fill
    // body shading (lower-back)
    if(!sil) pell(ctx,bx-dir*Math.round(rx*0.3),by+Math.round(ry*0.35),Math.round(rx*0.7),Math.round(ry*0.55),shade(P.body,-0.14));
    // belly
    if(!sil && P.belly) pell(ctx,bx+dir*Math.round(rx*0.3),by+Math.round(ry*0.35),Math.round(rx*0.66),Math.round(ry*0.6),P.belly);
    // bib (breast splash)
    if(!sil && P.bib) pell(ctx,bx+dir*Math.round(rx*0.55),by-Math.round(ry*0.05),Math.round(rx*0.4),Math.round(ry*0.55),P.bib);

    /* ---- folded wing (perched) ---- */
    if(!flying){
      pell(ctx,bx-dir*Math.round(rx*0.05),by+1,Math.round(rx*0.62),Math.round(ry*0.62),col("wing"));
      if(!sil){
        pell(ctx,bx-dir*Math.round(rx*0.05),by+1,Math.round(rx*0.62),Math.round(ry*0.62)-1,shade(P.wing,0.0));
        px(ctx,bx-dir*Math.round(rx*0.4),by+Math.round(ry*0.4),Math.round(rx*0.4),1,shade(P.wing,-0.2));
      }
    }

    /* ---- crest ---- */
    if(sh.crest){
      const cc=col("cap")&&P.cap?P.cap:col("head");
      const top=hy-hr;
      if(sil){ px(ctx,hx-1,top-3,2,4,sil); }
      else {
        px(ctx,hx-dir,top-2,1,3,cc);
        px(ctx,hx,top-3,1,4,cc);
        px(ctx,hx+dir,top-2,1,3,shade(cc,-0.1));
      }
    }

    /* ---- head ---- */
    pell(ctx,hx,hy,hr,hr,col("head"));
    if(!sil){
      if(P.cap)  pell(ctx,hx,hy-Math.round(hr*0.55),hr,Math.round(hr*0.7),P.cap);
      if(P.cheek)pell(ctx,hx+dir*Math.round(hr*0.35),hy+Math.round(hr*0.25),Math.round(hr*0.55),Math.round(hr*0.45),P.cheek);
      if(P.mask) pell(ctx,hx+dir*Math.round(hr*0.45),hy+Math.round(hr*0.1),Math.round(hr*0.6),Math.round(hr*0.55),P.mask);
    }

    /* ---- beak (small 3px wedge) ---- */
    const bkx=hx+dir*hr, bky=hy, beakC=sil||col("beak");
    px(ctx,bkx,bky-1,1,2,beakC);
    px(ctx,bkx+dir,bky,1,1,beakC);
    px(ctx,bkx+dir*2,bky,1,1, sil||shade(P.beak||"#333",-0.12));

    /* ---- eye ---- */
    if(!sil){
      const ex=hx+dir*Math.round(hr*0.45), ey=hy-Math.round(hr*0.15);
      dot(ctx,ex,ey, P.eye||"#161616");
      dot(ctx,ex-dir,ey-0, "rgba(255,255,255,.85)");
    }

    /* ---- near wing (flight) ---- */
    if(flying){
      drawWing(ctx,bx,by,dir,rx,ry,Math.round(flap*3),col("wing"),OUT,sil,false);
    }

    /* ---- emote (upright, integer) ---- */
    if(o.emote){
      const ey=by-ry-hr-6;
      drawEmote(ctx,bx,ey,o.emote,o.emoteFade==null?1:o.emoteFade);
    }
  }

  function drawTail(ctx,x,y,dir,len,long,color,out,sil){
    for(let i=0;i<len;i++){
      const xx=x+dir*i;
      const h=1+Math.floor(i*(long?0.7:0.45));
      const yy=y+Math.floor(i*0.25);
      px(ctx,xx,yy-1,1,h+2,out);      // outline
    }
    for(let i=0;i<len;i++){
      const xx=x+dir*i;
      const h=1+Math.floor(i*(long?0.7:0.45));
      const yy=y+Math.floor(i*0.25);
      px(ctx,xx,yy,1,h, sil||color);
    }
  }

  function drawWing(ctx,bx,by,dir,rx,ry,off,color,out,sil,back){
    const wx=bx-dir*Math.round(rx*0.1);
    const wy=by-Math.round(ry*0.2)+off;
    const wrx=Math.round(rx*0.85), wry=Math.round(ry*0.5);
    pell(ctx,wx-dir*Math.round(wrx*0.4),wy,wrx+1,wry+1,out);
    pell(ctx,wx-dir*Math.round(wrx*0.4),wy,wrx,wry, sil||color);
    if(!sil && !back) px(ctx,wx-dir*wrx,wy,Math.round(wrx*0.7),1,shade(color,-0.2));
  }

  /* ---- emotes ---- */
  const HEART=["01010","11111","11111","01110","00100"];
  const SAD  =["00100","01110","11111","11111","01110"];
  function drawEmote(ctx,cx,cy,type,fade){
    ctx.save(); ctx.globalAlpha=Math.max(0,Math.min(1,fade));
    if(type==="happy"||type==="note"){
      stamp(ctx,HEART,cx-2,cy-2,"#e3617a");
      if(type==="happy"){ ctx.globalAlpha*=0.8; stamp(ctx,HEART,cx+3,cy-5,"#f4a6b6"); }
    } else if(type==="sad"){
      stamp(ctx,SAD,cx-2,cy-2,"#8a8f97");
    }
    ctx.restore();
  }
  function stamp(ctx,grid,x,y,color){
    ctx.fillStyle=color;
    for(let r=0;r<grid.length;r++) for(let c=0;c<grid[r].length;c++)
      if(grid[r][c]==="1") ctx.fillRect((x+c)|0,(y+r)|0,1,1);
  }

  /* ---- portrait into a small canvas (index / cards / toasts) ----
     The bird is drawn at integer scale so it stays crisp & fills the cell. */
  function drawPortrait(canvas, sp, opts={}){
    const ctx=canvas.getContext("2d");
    ctx.imageSmoothingEnabled=false;
    const w=canvas.width, h=canvas.height;
    ctx.clearRect(0,0,w,h);
    const scale=Math.max(1, Math.round(h/20));
    ctx.save(); ctx.scale(scale,scale);
    const cw=w/scale, ch=h/scale;
    drawBird(ctx, sp, {
      x:Math.round(cw*0.5), y:Math.round(ch*0.56), facing:1,
      mode:opts.fly?"fly":"perch", flapPhase:opts.fly?-0.6:0,
      bob:0, peck:0, noShadow:true, silhouette:opts.silhouette,
    });
    ctx.restore();
  }

  /* ---- yard decorations (bought in the shop) ---- */
  function drawDecor(ctx,type,x,y,level,t){
    x=Math.round(x); y=Math.round(y); t=t||0;
    if(type==="flowers"){
      // a proper raised flower bed with wooden edging; density grows with level
      const cols=[["#e8584f","#ff8a80"],["#f0c419","#ffe27a"],["#ffffff","#fff7d8"],
                  ["#cf6fd0","#efa6ef"],["#f08a3a","#ffb877"],["#6db0ec","#aed6f7"]];
      const halfW=24, soilTop=y, soilH=6;
      pell(ctx,x,y+soilH+2,halfW+3,3,"rgba(40,30,18,.22)");                 // shadow
      // soil
      px(ctx,x-halfW,soilTop,halfW*2,soilH,"#5b3f27");
      px(ctx,x-halfW,soilTop,halfW*2,2,"#6f4d30");
      for(let i=0;i<10;i++) dot(ctx,x-halfW+3+((i*9)%(halfW*2-4)),soilTop+2+((i*5)%(soilH-2)),"#4a3220");
      // wooden edging
      px(ctx,x-halfW-2,soilTop-1,halfW*2+4,2,"#8a5f33");                    // front lip
      px(ctx,x-halfW-2,soilTop-1,halfW*2+4,1,"#b07d44");
      px(ctx,x-halfW-2,soilTop-1,2,soilH+2,"#8a5f33"); px(ctx,x+halfW,soilTop-1,2,soilH+2,"#8a5f33");
      // flowers — rows of swaying blossoms
      const n=5+level*3, span=halfW*2-8;
      for(let i=0;i<n;i++){
        const row=i%2, fx=x-halfW+5+Math.round((i/(n-1||1))*span);
        const baseY=soilTop-1-row*3, h=6+((i*3)%4);
        const sway=Math.round(Math.sin(t*1.7+i*1.3)*1.2);
        const [pc,ph]=cols[i%cols.length];
        px(ctx,fx,baseY-h,1,h,"#4e8a35");                                   // stem
        dot(ctx,fx+ (i%2?1:-1),baseY-h+2,"#5fa83f");                        // leaf
        const bx=fx+sway, by=baseY-h-2;
        if(i%3===0){ // tulip-ish
          px(ctx,bx-1,by,3,3,pc); dot(ctx,bx,by-1,pc); dot(ctx,bx,by,ph);
        } else {     // round bloom
          dot(ctx,bx,by-1,pc); dot(ctx,bx-1,by,pc); dot(ctx,bx+1,by,pc); dot(ctx,bx,by+1,pc);
          dot(ctx,bx,by,"#f7e9a0");
        }
      }
    } else if(type==="birdbath"){
      const st="#b8b2a4", stHi="#d8d3c7", stDk="#8c867a";
      const water="#a9def0", waterHi="#e3f5fb", waterDk="#74c2dc";
      pell(ctx,x,y+4,13,3,"rgba(40,30,18,.25)");                           // ground shadow
      // base foot
      pell(ctx,x,y+2,9,3,stDk); pell(ctx,x,y+1,8,2,st); pell(ctx,x,y,7,2,stHi);
      // pedestal column
      px(ctx,x-3,y-12,6,14,st); px(ctx,x-3,y-12,2,14,stHi); px(ctx,x+2,y-12,1,14,stDk);
      px(ctx,x-4,y-7,8,2,stDk); px(ctx,x-4,y-7,8,1,st);                    // collar band
      // bowl exterior
      pell(ctx,x,y-13,12,4,stDk); pell(ctx,x,y-14,12,4,st); pell(ctx,x,y-15,13,3,stHi);
      // water basin
      pell(ctx,x,y-16,10,3,water); pell(ctx,x,y-17,9,2,waterDk); pell(ctx,x,y-17,9,1,water);
      // animated ripple + sparkle
      const k=(Math.sin(t*1.8)*0.5+0.5), rw=Math.round(2+k*6);
      ctx.globalAlpha=0.75*(1-k);
      ctx.fillStyle=waterHi; ctx.fillRect(x-rw,y-17,2,1); ctx.fillRect(x+rw-1,y-17,2,1);
      ctx.globalAlpha=1;
      dot(ctx,x-3,y-17,waterHi); dot(ctx,x+4,y-16,waterHi);
    } else if(type==="platform"){
      const W="#a4764b", WD="#75502f", WH="#c59a66";
      pell(ctx,x,y+3,16,3,"rgba(40,30,18,.25)");                           // shadow
      px(ctx,x-13,y-1,3,7,WD); px(ctx,x+10,y-1,3,7,WD);                    // legs
      px(ctx,x-15,y-5,30,4,WD); px(ctx,x-14,y-5,28,3,W); px(ctx,x-14,y-5,28,1,WH);  // tray
      for(let i=0;i<7;i++) dot(ctx,x-11+i*3,y-6,i%2?"#e0bd74":"#caa15c"); // seed mound
      px(ctx,x-14,y-2,28,1,WD);
    } else if(type==="peanut_post"){
      pell(ctx,x,y+3,7,2,"rgba(40,30,18,.25)");
      px(ctx,x-1,y-26,3,28,"#8a5f33"); px(ctx,x-1,y-26,1,28,"#b07d44");    // post
      px(ctx,x-4,y-26,9,2,"#6e4a28");                                      // cap
      const pn="#cda572", pnd="#a8814f";
      for(let i=0;i<6;i++){ const yy=y-23+i*4, sx=x+(i%2?2:-4);           // peanuts on a string
        pell(ctx,sx,yy,2,1,pn); pell(ctx,sx,yy+1,2,1,pn); dot(ctx,sx,yy,pnd); dot(ctx,sx+1,yy+1,pnd); }
    } else if(type==="fruit_tree"){
      pell(ctx,x,y+4,12,3,"rgba(40,30,18,.25)");
      px(ctx,x-2,y-20,4,22,"#7c5a36"); px(ctx,x-2,y-20,1,22,"#9a7547"); px(ctx,x+1,y-20,1,22,"#5e4327"); // trunk
      px(ctx,x-6,y-12,4,2,"#7c5a36"); px(ctx,x+2,y-14,4,2,"#7c5a36");     // little branches
      pell(ctx,x,y-27,15,11,"#2f6e2c"); pell(ctx,x-7,y-23,9,7,"#54a344");
      pell(ctx,x+7,y-24,8,6,"#54a344"); pell(ctx,x,y-30,13,7,"#7cc657");  // canopy
      for(const [dx,dy] of [[-7,-25],[5,-27],[-2,-21],[9,-22],[1,-31],[-9,-28],[6,-31]]){
        dot(ctx,x+dx,y+dy,"#c23026"); dot(ctx,x+dx,y+dy-1,"#e8584f"); }
    } else if(type==="owldecoy"){          // Owl Decoy upgrade
      pell(ctx,x,y+3,6,2,"rgba(40,30,18,.25)");
      px(ctx,x-1,y-15,3,17,"#8a5f33"); px(ctx,x-1,y-15,1,17,"#b07d44");      // post
      px(ctx,x-3,y-16,7,1,"#6e4a28");                                       // cap
      const o="#7d5a38", ol="#9c7547", e="#f6d24a";
      pell(ctx,x,y-21,5,5,o); pell(ctx,x,y-22,4,4,ol);                      // body/head
      px(ctx,x-4,y-26,2,2,o); px(ctx,x+3,y-26,2,2,o);                       // ear tufts
      px(ctx,x-3,y-23,2,2,e); px(ctx,x+2,y-23,2,2,e);                       // eyes
      dot(ctx,x-2,y-23,"#2a2018"); dot(ctx,x+2,y-23,"#2a2018");             // pupils
      dot(ctx,x,y-20,"#d8843a");                                           // beak
    } else if(type==="gnome"){             // Hire a Helper (caretaker)
      pell(ctx,x,y+2,5,2,"rgba(40,30,18,.25)");
      px(ctx,x-3,y-7,6,7,"#4f7bb0"); px(ctx,x-3,y-7,2,7,"#6a96cb");         // blue coat
      px(ctx,x-2,y-2,5,2,"#5e4327");                                        // boots
      pell(ctx,x,y-10,3,2,"#f0cba0");                                       // face
      px(ctx,x-2,y-9,4,2,"#ece6da");                                        // white beard
      dot(ctx,x-1,y-10,"#2a2018"); dot(ctx,x+1,y-10,"#2a2018");             // eyes
      px(ctx,x-3,y-12,6,1,"#c23026"); px(ctx,x-2,y-14,4,1,"#c23026"); px(ctx,x-1,y-16,2,1,"#c23026"); dot(ctx,x,y-17,"#c23026"); // pointy hat
    } else if(type==="berrybush"){         // Berry Bushes (rarity), scales with level
      const lv=Math.max(1,level||1);
      pell(ctx,x,y+3,12,3,"rgba(40,30,18,.25)");
      pell(ctx,x,y-6,12,7,"#2f6e2c"); pell(ctx,x-5,y-4,7,5,"#4e9442"); pell(ctx,x+5,y-5,6,4,"#4e9442"); pell(ctx,x,y-10,10,5,"#63b057");
      let s=991; const n=4+lv*2;
      for(let i=0;i<n;i++){ s=(s*1103515245+12345)&0x7fffffff; const bx=x-9+(s>>6)%19; s=(s*1103515245+12345)&0x7fffffff; const by=y-11+(s>>6)%9;
        dot(ctx,bx,by,"#3a4fc4"); dot(ctx,bx,by-1,"#6a7ce0"); }
    } else if(type==="sign"){              // Welcome Sign (frenzy)
      pell(ctx,x,y+3,7,2,"rgba(40,30,18,.25)");
      px(ctx,x-1,y-15,3,17,"#8a5f33"); px(ctx,x-1,y-15,1,17,"#b07d44");     // post
      px(ctx,x-10,y-23,20,9,"#caa15c"); px(ctx,x-10,y-23,20,1,"#e0bd74"); px(ctx,x-10,y-15,20,1,"#9c7636"); // board
      px(ctx,x-10,y-23,1,9,"#8a6740"); px(ctx,x+9,y-23,1,9,"#8a6740");      // frame
      const r="#c8473a"; dot(ctx,x-2,y-21,r); dot(ctx,x+1,y-21,r); px(ctx,x-3,y-20,6,1,r); px(ctx,x-2,y-19,4,1,r); px(ctx,x-1,y-18,2,1,r); // heart
    } else if(type==="perchpole"){         // Extra Perch (perches)
      pell(ctx,x,y+3,4,2,"rgba(40,30,18,.25)");
      px(ctx,x-1,y-19,2,21,"#9aa0a6"); px(ctx,x-1,y-19,1,21,"#c2c6cc");     // metal pole
      px(ctx,x-6,y-19,13,2,"#8a5f33"); px(ctx,x-6,y-19,13,1,"#b07d44");     // wooden cross-perch
      dot(ctx,x+6,y-21,"#5fa83f"); dot(ctx,x-6,y-20,"#5fa83f");             // leaves
    } else if(type==="berry_thicket"){     // Woodland — Scarlet Tanager
      pell(ctx,x,y+3,13,3,"rgba(40,30,18,.25)");
      pell(ctx,x,y-6,13,8,"#2c5e2a"); pell(ctx,x-6,y-4,8,5,"#3f7a3a"); pell(ctx,x+6,y-5,7,5,"#3f7a3a"); pell(ctx,x,y-12,11,6,"#4e8a44");
      let s=331; for(let i=0;i<11;i++){ s=(s*1103515245+12345)&0x7fffffff; const bx=x-9+(s>>6)%19; s=(s*1103515245+12345)&0x7fffffff; const by=y-13+(s>>6)%11;
        dot(ctx,bx,by,"#5a1a3a"); dot(ctx,bx,by-1,"#8a2a52"); }
    } else if(type==="suet_log"){          // Woodland — Pileated Woodpecker
      pell(ctx,x,y+3,6,2,"rgba(40,30,18,.25)");
      px(ctx,x-1,y-18,3,20,"#7c5a36"); px(ctx,x-1,y-18,1,20,"#9a7547");      // post
      px(ctx,x-5,y-23,11,7,"#8a6740"); px(ctx,x-5,y-23,11,1,"#a3804f"); px(ctx,x-5,y-17,11,1,"#5e4327"); // log
      pell(ctx,x-5,y-20,2,3,"#6e4a28"); pell(ctx,x+5,y-20,2,3,"#6e4a28");    // ends
      for(const [dx,dy] of [[-1,-21],[2,-19],[-3,-19]]) px(ctx,x+dx,y+dy,2,2,"#e7c878"); // suet plugs
    } else if(type==="oriole_feeder"){     // Woodland — Baltimore Oriole
      pell(ctx,x,y+3,6,2,"rgba(40,30,18,.25)");
      px(ctx,x-1,y-20,3,22,"#8a5f33"); px(ctx,x-1,y-20,1,22,"#b07d44");      // post
      px(ctx,x-7,y-20,15,2,"#6e4a28");                                       // crossbar
      pell(ctx,x-6,y-16,3,3,"#e8772a"); pell(ctx,x-6,y-16,3,2,"#f0902f"); dot(ctx,x-6,y-16,"#fff0d0"); // orange half
      px(ctx,x+4,y-17,3,3,"#bfe6f2"); px(ctx,x+4,y-17,3,1,"#f4c84a");        // nectar cup
    } else if(type==="fishing_perch"){     // Wetland — Belted Kingfisher
      pell(ctx,x,y+1,11,3,"#7fb8d0"); pell(ctx,x,y,9,2,"#a9def0"); dot(ctx,x-3,y,"#e3f5fb"); // water
      px(ctx,x-1,y-21,3,19,"#8a5f33"); px(ctx,x-1,y-21,1,19,"#b07d44");      // post
      for(let i=0;i<9;i++) px(ctx,x+1+i,y-21+Math.round(i*0.55),1,1,"#7c5a36"); // branch
      dot(ctx,x+9,y-16,"#5fa83f");
    } else if(type==="reed_pool"){         // Wetland — Great Blue Heron
      pell(ctx,x,y+2,15,4,"rgba(40,30,18,.2)");
      pell(ctx,x,y-1,14,4,"#5f9ec4"); pell(ctx,x,y-2,12,3,"#a9def0"); dot(ctx,x-4,y-2,"#e3f5fb"); dot(ctx,x+4,y-1,"#e3f5fb"); // water
      for(const dx of [-10,-6,7,11]){ px(ctx,x+dx,y-15,1,14,"#5e7a3a"); px(ctx,x+dx-1,y-17,3,3,"#7c5a36"); } // cattails
    } else if(type==="pine_bough"){        // Alpine — Pine Grosbeak
      pell(ctx,x,y+3,9,3,"rgba(40,30,18,.25)");
      px(ctx,x-1,y-6,3,8,"#5e4327");                                         // trunk
      pell(ctx,x,y-8,10,4,"#2c5a32"); pell(ctx,x,y-13,8,4,"#357a3c"); pell(ctx,x,y-18,6,4,"#357a3c"); pell(ctx,x,y-22,4,3,"#4e9442");
      dot(ctx,x-4,y-9,"#7c5a36"); dot(ctx,x+4,y-12,"#7c5a36"); dot(ctx,x-2,y-16,"#c0566a"); // cones + a grosbeak-red dot
    } else if(type==="cliff_patch"){       // Alpine — Rosy-Finch
      pell(ctx,x,y+3,12,3,"rgba(40,30,18,.25)");
      pell(ctx,x,y-4,11,6,"#8c867a"); pell(ctx,x-3,y-6,6,4,"#a39d8f"); pell(ctx,x+4,y-4,5,3,"#7a7468"); // rock
      px(ctx,x-10,y-1,20,2,"#e8eef2");                                       // snow base
      for(const [dx,dy] of [[-4,-8],[0,-9],[3,-8],[-1,-7]]) dot(ctx,x+dx,y+dy,"#caa15c"); // seed
    } else if(type==="eagle_eyrie"){       // Alpine — Golden Eagle
      pell(ctx,x,y+4,10,3,"rgba(40,30,18,.25)");
      px(ctx,x-4,y-25,9,27,"#8c867a"); px(ctx,x-4,y-25,3,27,"#a39d8f"); px(ctx,x+3,y-25,2,27,"#6e685c"); // crag
      px(ctx,x-4,y-25,2,2,"#7a7468"); px(ctx,x+2,y-23,3,2,"#7a7468");        // jagged
      pell(ctx,x,y-27,7,3,"#8a6740"); pell(ctx,x,y-28,6,2,"#5e4327"); dot(ctx,x,y-29,"#e8e0d2"); // stick nest + egg
      px(ctx,x-8,y-1,18,2,"#e8eef2");                                        // snow base
    }
  }
  /* draw a decoration scaled (for depth) while keeping pixels crisp: render to an
     offscreen buffer at native size, then blit it back with nearest-neighbour */
  let _decorBuf=null, _decorCtx=null; const _DBW=104, _DBH=104, _DAX=52, _DAY=80;
  function drawDecorScaled(ctx, type, x, y, level, t, scale){
    scale = scale || 1;
    if(scale===1 || typeof document==="undefined"){ drawDecor(ctx,type,x,y,level,t); return; }
    if(!_decorBuf){ _decorBuf=document.createElement("canvas"); _decorBuf.width=_DBW; _decorBuf.height=_DBH; _decorCtx=_decorBuf.getContext("2d"); _decorCtx.imageSmoothingEnabled=false; }
    _decorCtx.clearRect(0,0,_DBW,_DBH);
    drawDecor(_decorCtx, type, _DAX, _DAY, level, t);
    const prev=ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled=false;
    ctx.drawImage(_decorBuf, Math.round(x-_DAX*scale), Math.round(y-_DAY*scale), Math.round(_DBW*scale), Math.round(_DBH*scale));
    ctx.imageSmoothingEnabled=prev;
  }

  /* ---- "tap me" hint drawn above the feeder when it wants attention ---- */
  function ringEllipse(ctx,cx,cy,rx,ry,color){
    ctx.fillStyle=color; const steps=22;
    for(let i=0;i<steps;i++){ const a=i/steps*Math.PI*2;
      ctx.fillRect(Math.round(cx+Math.cos(a)*rx), Math.round(cy+Math.sin(a)*ry), 1, 1); }
  }
  function drawTapHint(ctx,x,y,t,strong){
    const bob=Math.round(Math.sin(t*4.5)*2.2);
    const fill = strong?"#ffd54a":"#ffe9a8", out="#5a3a18";
    // pulsing halo ring around the tray
    const k=(Math.sin(t*3)*0.5+0.5);
    ctx.globalAlpha=(strong?0.55:0.32)*(0.4+0.6*(1-k));
    ringEllipse(ctx,x,y+3,16+k*6,7+k*2, strong?"#ffe06a":"#ffffff");
    ctx.globalAlpha=1;
    // downward arrow floating above the tray
    const top=y-30+bob, ax=x;
    px(ctx,ax-2,top-1,5,8,out); px(ctx,ax-1,top,3,7,fill);                 // shaft
    for(let r=0;r<5;r++){ const half=4-r; px(ctx,ax-half-1,top+7+r,(half+1)*2+1,1,out); } // head outline
    for(let r=0;r<4;r++){ const half=3-r; px(ctx,ax-half,top+8+r,half*2+1,1,fill); }       // head fill
  }

  /* ---- ongoing "fresh seed" aura around the feeder while a Scatter buff is live ---- */
  function drawScatterAura(ctx,x,y,t,s){
    if(s<=0.02) return;
    const cy=y-26, pulse=Math.sin(t*3)*0.5+0.5;
    // glowing halo rings (brightness/size scale with buff strength)
    ctx.globalAlpha=0.22*s*(0.7+0.3*pulse);
    ringEllipse(ctx,x,cy,18+pulse*4, 11+pulse*3, "#bfeaf2");
    ctx.globalAlpha=0.15*s;
    ringEllipse(ctx,x,cy,27, 17, "#ffffff");
    // rising sparkle motes
    const n=Math.round(3+s*6);
    for(let i=0;i<n;i++){
      const ph=t*0.7 + i*0.93, life=ph-Math.floor(ph);
      const mx=x + Math.sin(i*2.3+Math.floor(ph))*(8+i*2.2);
      const my=y-6 - life*36, a=(1-life)*Math.min(1,s*1.3);
      if(a<=0.05) continue;
      ctx.globalAlpha=a; ctx.fillStyle=(i%2)?"#fff4b0":"#bfeaf2";
      const sz=a>0.6?2:1; ctx.fillRect(Math.round(mx),Math.round(my),sz,sz);
    }
    ctx.globalAlpha=1;
  }
  /* ---- dramatic burst when a rare/legendary bird arrives (p = 0..1) ---- */
  function drawArrivalBurst(ctx,x,y,p,color,leg){
    x=Math.round(x); y=Math.round(y); const a=1-p, R=p*(leg?64:40);
    if(p<0.3){ ctx.globalAlpha=(0.3-p)*3.2; pell(ctx,x,y,leg?13:8,leg?9:6,"#fffbe0"); }
    ctx.globalAlpha=a*0.9; ringEllipse(ctx,x,y,4+R,(4+R)*0.7,color);
    ctx.globalAlpha=a*0.55; ringEllipse(ctx,x,y,2+R*0.6,(2+R*0.6)*0.7,"#ffffff");
    if(leg){ ctx.globalAlpha=a*0.8; ctx.fillStyle=color;          // radiating spokes
      for(let i=0;i<10;i++){ const ang=i/10*Math.PI*2 + p*1.6;
        ctx.fillRect(Math.round(x+Math.cos(ang)*R), Math.round(y+Math.sin(ang)*R*0.7), 2,2); } }
    ctx.globalAlpha=1;
  }
  /* ---- one-shot burst the moment you Scatter (p = 0..1 progress) ---- */
  function drawScatterBurst(ctx,x,y,p){
    const cy=y-24, a=1-p;
    if(p<0.22){ ctx.globalAlpha=(0.22-p)*4.5; pell(ctx,x,cy,11,7,"#fffbe0"); ctx.globalAlpha=1; }
    ctx.globalAlpha=a*0.85; ringEllipse(ctx,x,cy,4+p*44, (4+p*44)*0.6, "#ffffff");
    ctx.globalAlpha=a*0.6;  ringEllipse(ctx,x,cy,2+p*30, (2+p*30)*0.42, "#bfeaf2");
    ctx.globalAlpha=1;
  }

  /* ---- hawk (predator event): a mean red-tailed hawk in a side-on
     swooping/attack pose — scowling brow, hooked beak, swept wing,
     rufous banded tail and outstretched grasping talons ---- */
  function drawHawk(ctx,x,y,facing,flap){
    const dir=facing>=0?1:-1; x=Math.round(x); y=Math.round(y);
    const out="#1d140a",  back="#5a3f22", backHi="#7a5630",
          belly="#e3d0a6", bellyDk="#b6975f",
          tail="#b35d2a", tailHi="#cf7437",
          prim="#160f07",  cere="#f0bf3a", eye="#f7d20f";
    const ph=Math.sin(flap);

    // a swept wing, tapering from shoulder root to a splayed primary tip
    const wing=(sx,sy,tx,ty,thick,col,colHi)=>{
      const n=9;
      for(let i=0;i<=n;i++){ const f=i/n;
        const fx=Math.round(sx+(tx-sx)*f), fy=Math.round(sy+(ty-sy)*f);
        const h=Math.max(1,Math.round(thick*(1-f)+1));
        px(ctx,fx,fy-h,2,h*2,out);
        px(ctx,fx,fy-h+1,1,h*2-2, i<n*0.4?col:colHi);
      }
      px(ctx,tx-dir*1,ty-2,3,1,prim); px(ctx,tx,ty,3,1,prim); px(ctx,tx-dir*1,ty+2,3,1,prim);
    };

    wing(x-dir*1, y-1, x-dir*7, y+4-Math.round(ph*2), 3, "#4a3219","#4a3219"); // far wing

    // fanned rufous tail, dark terminal band
    pell(ctx,x-dir*9,y+1,5,4,out);
    pell(ctx,x-dir*9,y+1,4,3,tail); pell(ctx,x-dir*8,y,3,2,tailHi);
    px(ctx,x-dir*13,y-1,2,5,out);

    // body + pale streaked underside
    pell(ctx,x,y,7,4,out); pell(ctx,x,y-1,6,3,back); pell(ctx,x-dir*1,y-2,3,2,backHi);
    pell(ctx,x+dir*2,y+2,4,2,belly);
    dot(ctx,x+dir*1,y+2,bellyDk); dot(ctx,x+dir*3,y+3,bellyDk); dot(ctx,x+dir*4,y+2,bellyDk);

    // outstretched talons (reaching forward to strike)
    const foot=(lx,ly)=>{
      px(ctx,lx,ly,1,2,cere);
      dot(ctx,lx-dir*1,ly+2,cere); dot(ctx,lx,ly+2,cere); dot(ctx,lx+dir*1,ly+2,cere);
      dot(ctx,lx-dir*1,ly+3,out);  dot(ctx,lx,ly+3,out);  dot(ctx,lx+dir*1,ly+3,out);
    };
    foot(x+dir*3,y+3); foot(x+dir*6,y+4);

    // mean head: hooked beak, fierce eye, heavy scowling brow
    pell(ctx,x+dir*6,y-2,3,3,out); pell(ctx,x+dir*6,y-2,3,2,back); pell(ctx,x+dir*6,y-3,2,1,backHi);
    px(ctx,x+dir*9,y-1,2,1,cere); dot(ctx,x+dir*11,y-1,"#caa024");      // hooked beak
    dot(ctx,x+dir*10,y,out); dot(ctx,x+dir*11,y,out);
    dot(ctx,x+dir*8,y-2,eye);                                            // eye
    px(ctx,x+dir*7,y-3,3,1,out); dot(ctx,x+dir*9,y-2,out);              // brow ridge / scowl

    wing(x+dir*1, y-2, x-dir*4, y-9-Math.round(ph*3), 4, back, backHi); // near wing (raised)
  }

  /* ---- seed-thief critters (squirrel & chipmunk events) ----
     drawn from a feet/ground origin (x,y); they sit & nibble at the
     feeder, then scurry off if not shooed. t drives a gentle idle bob. */
  function drawSquirrel(ctx,x,y,facing,t){
    const dir=facing>=0?1:-1; x=Math.round(x); y=Math.round(y); t=t||0;
    const out="#2a1c0f", body="#a9743f", back="#8a5d30", bodyHi="#c08c50",
          belly="#e8d6ab", tail="#b5783f", fringe="#e3c896", nose="#3a2a1a", seed="#d6b06a";
    y+=Math.round(Math.sin(t*3)*0.5);
    pell(ctx,x,y+1,7,2,"rgba(40,30,18,.28)");                          // ground shadow

    // big bushy tail: a plume curling up behind and over the back
    const tailPts=[[-4,-2],[-6,-6],[-6,-11],[-4,-14],[-1,-15]];
    for(const[ax,ay]of tailPts) pell(ctx,x+dir*ax,y+ay,4,4,out);
    for(const[ax,ay]of tailPts) pell(ctx,x+dir*ax,y+ay,3,3,tail);
    px(ctx,x-dir*9,y-7,2,4,fringe); dot(ctx,x-dir*8,y-3,fringe);
    dot(ctx,x-dir*7,y-13,fringe); dot(ctx,x-dir*5,y-16,fringe); dot(ctx,x-dir*2,y-17,fringe);

    // haunch / back foot
    pell(ctx,x,y-2,4,3,out); pell(ctx,x,y-2,3,2,back);
    px(ctx,x+dir*2,y-1,3,2,out); px(ctx,x+dir*2,y-1,3,1,body);

    // body (upright) + pale belly
    pell(ctx,x+dir*1,y-7,4,5,out); pell(ctx,x+dir*1,y-7,3,4,body); pell(ctx,x+dir*1,y-8,2,2,bodyHi);
    pell(ctx,x+dir*3,y-6,2,3,belly);

    // head
    pell(ctx,x+dir*4,y-11,3,3,out); pell(ctx,x+dir*4,y-11,3,2,body);
    px(ctx,x+dir*3,y-14,2,2,out); px(ctx,x+dir*3,y-14,1,1,back);       // ear
    dot(ctx,x+dir*4,y-13,bodyHi);
    dot(ctx,x+dir*6,y-10,"#ffffff"); dot(ctx,x+dir*5,y-11,out);        // eye + glint
    dot(ctx,x+dir*7,y-10,nose);                                        // nose

    // front paws holding a seed at the mouth
    px(ctx,x+dir*5,y-8,2,1,body); dot(ctx,x+dir*6,y-9,seed); dot(ctx,x+dir*7,y-9,seed);
  }
  function drawChipmunk(ctx,x,y,facing,t){
    const dir=facing>=0?1:-1; x=Math.round(x); y=Math.round(y); t=t||0;
    const out="#2a1c0f", body="#b07d44", back="#9c6a37", belly="#efe1bf",
          dk="#34251a", lt="#f2e8cf", nose="#3a2a1a";
    y+=Math.round(Math.sin(t*3.4)*0.5);
    pell(ctx,x,y+1,6,2,"rgba(40,30,18,.28)");                          // shadow

    pell(ctx,x-dir*4,y-4,2,4,out); pell(ctx,x-dir*4,y-4,2,3,back); dot(ctx,x-dir*4,y-6,lt); // stubby tail

    // body (low, on all fours) + pale belly
    pell(ctx,x,y-3,5,3,out); pell(ctx,x,y-3,4,2,body);
    pell(ctx,x+dir*1,y-2,3,1,belly);
    px(ctx,x-dir*2,y-5,5,1,dk); px(ctx,x-dir*2,y-4,5,1,lt);            // signature racing stripe
    dot(ctx,x-dir*2,y,out); dot(ctx,x+dir*2,y,out);                    // feet

    // head with a stuffed cheek pouch
    pell(ctx,x+dir*4,y-5,3,3,out); pell(ctx,x+dir*4,y-5,3,2,body);
    pell(ctx,x+dir*4,y-3,2,2,belly);                                   // fat cheek
    px(ctx,x+dir*3,y-7,1,2,out);                                       // ear
    dot(ctx,x+dir*5,y-5,"#ffffff"); dot(ctx,x+dir*4,y-5,out);          // eye
    px(ctx,x+dir*3,y-5,1,1,lt);                                        // eye stripe
    dot(ctx,x+dir*6,y-4,nose);                                         // nose
  }
  function drawCritter(ctx,kind,x,y,facing,t){
    if(kind==="chipmunk") drawChipmunk(ctx,x,y,facing,t); else drawSquirrel(ctx,x,y,facing,t);
  }

  /* ===========================================================
     PIXEL ICONS  (drawn in a 16x16 cell; used across the UI in
     place of emoji so everything matches the game's art)
     =========================================================== */
  function drawIcon(ctx, name, ox, oy){
    ox=Math.round(ox||0); oy=Math.round(oy||0);
    const P=(x,y,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(ox+x,oy+y,w,h); };
    const D=(x,y,c)=>{ ctx.fillStyle=c; ctx.fillRect(ox+x,oy+y,1,1); };
    const E=(cx,cy,rx,ry,c)=>pell(ctx,ox+cx,oy+cy,rx,ry,c);
    switch(name){
      case "star": {
        const g="#efb21c", gl="#ffe27a";
        P(7,2,2,12,g); P(2,7,12,2,g);
        D(7,1,g);D(8,1,g);D(7,14,g);D(8,14,g);D(1,7,g);D(1,8,g);D(14,7,g);D(14,8,g);
        P(6,6,4,4,gl); D(3,3,gl);D(12,12,gl);D(12,3,gl);D(3,12,gl); break; }
      case "feather": {
        const fb="#7fa9cf", fl="#cfe2f0", sh="#f4f0e6";
        for(let i=0;i<12;i++){ const cx=11-i*0.55, w=Math.round(Math.sin(i/12*Math.PI)*4);
          P(Math.round(cx-w), 2+i, w+1, 1, i<2?fl:fb); D(Math.round(cx), 2+i, sh); }
        D(4,13,sh); D(3,14,sh); break; }
      case "seed": {
        const s="#caa15c", sd="#9c7636", sl="#e0bd74";
        E(5,7,2,3,s); E(10,9,2,3,s); E(8,5,2,3,s);
        D(5,6,sl);D(10,8,sl);D(8,4,sl); D(5,9,sd);D(10,11,sd);D(8,7,sd); break; }
      case "safflower": {
        const s="#ece5d2", sd="#c8bda0", sl="#fbf6e8";
        E(5,7,2,3,s); E(10,9,2,3,s); E(8,5,2,3,s);
        D(5,6,sl);D(10,8,sl);D(8,4,sl); D(5,9,sd);D(10,11,sd);D(8,7,sd); break; }
      case "peanut": {
        const p="#cda572", pd="#a8814f", ph="#e6c993";
        E(6,6,2,3,p); E(9,10,2,3,p); P(7,8,2,2,p);
        D(6,4,ph);D(9,8,ph); D(6,7,pd);D(9,12,pd); D(7,9,pd); break; }
      case "mealworm": {
        const m="#cda572", md="#a8814f", mh="#e6c993";
        for(let i=0;i<6;i++){ const wx=4+i*1.6, wy=9-Math.round(Math.sin(i*0.95)*2.2);
          E(wx,wy,1,2,m); D(wx,wy-1,mh); D(wx,wy+1,md); }
        D(13,7,"#3a2c1c"); break; }   // head
      case "suet": {
        P(3,5,10,7,"#e7c878"); P(3,5,10,1,"#f2dc9a"); P(3,11,10,1,"#c9a458");
        for(let y=6;y<11;y+=2) for(let x=4;x<12;x+=2) D(x,y,"#caa253"); break; }
      case "nyjer": {
        const s="#3a3026"; for(const[x,y]of[[5,5],[8,6],[6,8],[9,9],[7,11],[10,7],[4,9]]){ P(x,y,1,2,s); D(x,y,"#5a4a36"); } break; }
      case "fruit": {
        E(7,9,4,4,"#d6473a"); E(7,9,4,4-1,"#e8584f"); D(6,7,"#f2a6a0");
        P(8,3,1,4,"#5e4327"); D(9,3,"#5aa344"); D(10,2,"#7cc657"); break; }
      case "nectar": {
        P(5,4,6,2,"#d8c89a"); P(6,6,4,7,"#bfe6f2"); P(6,6,4,3,"#f4c84a"); P(6,6,1,7,"#ffffff"); break; }
      case "heart": {
        const r="#d8485c", rl="#ef7d8e"; const g=["01010","11111","11111","01110","00100"];
        for(let y=0;y<5;y++)for(let x=0;x<5;x++) if(g[y][x]==="1") P(5+x,5+y,1,1, y<2&&x<2?rl:r); break; }
      case "book": {
        P(3,3,10,11,"#8a5a3c"); P(4,3,9,11,"#a8704a"); P(7,3,1,11,"#5e3a24");
        P(8,4,4,2,"#f2efe6"); P(8,7,4,1,"#e8e0d2"); P(8,9,3,1,"#e8e0d2");
        E(5,7,1,2,"#d6473a"); break; }   // little red bird mark
      case "wrench": {
        const m="#aab0b6", md="#7a808a", h="#cfd4da";
        for(let i=0;i<8;i++){ D(5+i,10-i,m); D(6+i,10-i,md); }
        P(3,3,4,4,m); D(5,5,"#e9e1cf"); P(10,9,4,4,m); D(11,11,h); break; }
      case "scroll": {
        P(4,3,8,10,"#f1e6c6"); P(4,3,8,1,"#d8c79a"); P(4,12,8,1,"#d8c79a");
        P(6,6,4,1,"#9a7a4c"); P(6,8,5,1,"#9a7a4c"); P(6,10,3,1,"#9a7a4c");
        D(5,5,"#5aa344"); break; }
      case "map": {
        P(3,4,10,9,"#e7dcb6"); P(3,4,3,9,"#cdbf94"); P(9,4,1,9,"#cdbf94");
        for(let i=0;i<7;i++) D(4+i,11-i,"#b08a4a"); E(11,6,1,1,"#d6473a"); break; }
      case "bird": {   // migrate / flight
        const b="#5b6b7a"; E(7,8,4,3,b); E(10,7,2,2,b); P(11,7,2,1,"#e0b23a");
        P(2,5,5,1,b); P(3,4,3,1,b); P(11,5,3,1,b); P(11,4,2,1,b); D(9,7,"#fff"); break; }
      case "leaf": {
        const a="#c8842f", b="#a85f24"; E(8,8,4,5,a); P(8,4,1,9,b);
        D(6,7,"#e3ab3c");D(7,6,"#e3ab3c"); break; }
      case "flower": {
        const p="#ef8fb0"; D(8,5,p);D(8,9,p);D(6,7,p);D(10,7,p); P(7,6,3,3,p); D(8,7,"#f4c84a");
        P(8,9,1,4,"#5aa344"); break; }
      case "sun": {
        E(8,8,3,3,"#ffe27a"); E(8,8,2,2,"#fff3c2");
        for(const[x,y]of[[8,2],[8,13],[2,8],[13,8],[4,4],[12,4],[4,12],[12,12]]) D(x,y,"#f4c84a"); break; }
      case "moon": {
        E(8,8,5,5,"#f3efce"); E(10,7,4,4,"#cfe2f0"); D(5,6,"#fff"); break; }
      case "cloud": {
        E(6,8,3,2,"#e6ecf0"); E(10,8,3,3,"#f2f5f7"); E(8,7,3,2,"#ffffff"); P(4,9,9,2,"#d6dee4"); break; }
      case "rain": {
        E(6,6,3,2,"#cdd6dc"); E(10,6,3,2,"#dde3e8"); P(4,7,9,2,"#bcc6cd");
        for(const x of [5,8,11]){ D(x,10,"#7fb2cb"); D(x,12,"#7fb2cb"); } break; }
      case "snow": {
        const c="#cfe2f0"; P(7,3,2,10,c); P(3,7,10,2,c);
        D(5,5,c);D(11,5,c);D(5,11,c);D(11,11,c); D(7,7,"#ffffff"); break; }
      case "flame": {
        P(7,4,2,9,"#e8772a"); E(8,9,3,4,"#f0a030"); E(8,11,2,2,"#f4c84a"); D(8,6,"#ffe06a"); break; }
      case "drop": {   // fresh seed / fill
        E(8,9,4,4,"#5fa8c4"); E(8,9,3,4,"#8fd0e2"); P(7,3,2,5,"#8fd0e2"); D(7,8,"#ffffff"); D(8,4,"#d4f0f8"); break; }
      case "speaker": {
        P(3,6,3,4,"#7a808a"); P(6,4,2,8,"#9aa0a6"); P(5,5,1,6,"#9aa0a6");
        D(10,6,"#5aa344");D(11,7,"#5aa344");D(11,8,"#5aa344");D(10,9,"#5aa344"); break; }
      case "mute": {
        P(3,6,3,4,"#7a808a"); P(6,4,2,8,"#9aa0a6"); P(5,5,1,6,"#9aa0a6");
        D(10,6,"#d6473a");D(13,6,"#d6473a");D(11,7,"#d6473a");D(12,7,"#d6473a");D(11,8,"#d6473a");D(12,8,"#d6473a");D(10,9,"#d6473a");D(13,9,"#d6473a"); break; }
      case "reset": {
        const c="#8a6740"; E(8,8,5,5,c); E(8,8,3,3,"#f6e9cf");
        P(11,3,3,1,c); P(13,3,1,4,c); D(11,4,c);D(12,5,c); break; }
      case "gear": {
        const m="#9aa0a6"; E(8,8,5,5,m); E(8,8,2,2,"#f6e9cf");
        for(const[x,y]of[[8,2],[8,13],[2,8],[13,8],[4,4],[12,12],[12,4],[4,12]]) D(x,y,"#7a808a"); break; }
      case "pin": {
        E(8,6,3,3,"#d6473a"); E(8,6,2,2,"#f2efe6"); P(7,8,2,5,"#b03a30"); break; }
      case "tray": {
        P(2,9,12,4,"#8a6740"); P(2,9,12,1,"#a3804f"); P(2,12,12,1,"#5e4327");
        P(4,7,8,2,"#caa15c"); D(5,6,"#e0bd74");D(8,6,"#e0bd74");D(10,7,"#e0bd74"); break; }
      case "can": {
        P(4,6,6,7,"#9aa0a6"); P(4,6,6,1,"#c6ccd2"); P(4,12,6,1,"#7a808a");
        P(3,7,1,4,"#7a808a"); P(9,5,3,1,"#9aa0a6"); P(11,3,1,3,"#9aa0a6");
        D(12,7,"#8fd0e2");D(13,9,"#8fd0e2");D(12,10,"#8fd0e2"); break; }
      case "scoop": {
        P(4,6,6,5,"#cdd2d8"); P(4,6,6,1,"#e9edf1"); P(4,10,6,1,"#a8aeb6");
        P(9,5,4,2,"#9aa0a6"); D(13,5,"#7a808a"); break; }
      case "perch": {   // a little bird sitting on a branch (Extra Perch)
        const w="#8a5f33", wl="#b07d44", b="#6da0d6", bl="#a6cdec";
        P(2,11,12,2,w); P(2,11,12,1,wl);                    // branch
        D(4,10,"#5fa83f"); D(12,9,"#5fa83f");               // leaves
        E(8,7,3,3,b); E(8,6,3,2,bl); P(10,6,2,1,"#e0b23a"); // body + beak
        D(7,6,"#2a2018"); P(7,11,1,1,w); P(9,11,1,1,w); break; }
      case "owl": {     // owl decoy (Owl Decoy)
        const o="#7d5a38", ol="#9c7547", e="#f6d24a";
        P(4,3,3,2,o); P(9,3,3,2,o);                         // ear tufts
        E(8,9,5,5,o); E(8,8,4,4,ol);                        // round head/body
        E(6,7,2,2,e); E(10,7,2,2,e);                        // big eyes
        D(6,7,"#2a2018"); D(10,7,"#2a2018");                // pupils
        D(8,8,"#d8843a"); D(8,9,"#c2752f"); break; }        // beak
      default: P(4,4,8,8,"#c0563f");
    }
  }
  /* render an icon onto its own (CSS-upscaled) canvas */
  function iconCanvas(name, cssSize){
    if(typeof document==="undefined") return null;
    const c=document.createElement("canvas"); c.width=16; c.height=16;
    c.className="icon"; if(cssSize){ c.style.width=cssSize+"px"; c.style.height=cssSize+"px"; }
    const x=c.getContext("2d"); x.imageSmoothingEnabled=false; drawIcon(x,name,0,0);
    return c;
  }

  return { L, drawBackground, drawFeeder, drawBird, drawPortrait, drawDecor, drawDecorScaled, drawTapHint,
           drawScatterAura, drawScatterBurst, drawArrivalBurst, drawHawk, drawCritter,
           drawIcon, iconCanvas, perchSlots, standHeight, pixelText, pixelTextWidth, shade };
})();

window.Sprites = Sprites;
