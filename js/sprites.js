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

  /* perch positions (feet points) */
  function perchSlots(feeder){
    const fx=feeder.x, ty=feeder.trayY;
    return [
      { x:fx-17, y:ty,    facing: 1 },
      { x:fx+17, y:ty,    facing:-1 },
      { x:fx-25, y:ty-2,  facing: 1 },
      { x:fx+25, y:ty-2,  facing:-1 },
      { x:fx,    y:ty-35, facing: 1 },
    ];
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
  function drawDecor(ctx,type,x,y,level){
    x=Math.round(x); y=Math.round(y);
    if(type==="flowers"){
      const cols=["#e8584f","#f0c419","#ffffff","#cf6fd0","#f08a3a"];
      const n=4+level*2;
      pell(ctx,x,y+3,16,4,"rgba(60,90,40,.30)");
      for(let i=0;i<n;i++){ const fx=x-12+((i*7)%26), fy=y-4-((i*5)%8);
        px(ctx,fx,fy+1,1,3,"#4e8a35"); dot(ctx,fx,fy,cols[i%cols.length]); dot(ctx,fx+1,fy,"#f7e9a0"); }
    } else if(type==="birdbath"){
      pell(ctx,x,y+4,10,3,"rgba(40,30,18,.25)");
      px(ctx,x-1,y-6,4,10,"#aaa396"); px(ctx,x-1,y-6,1,10,"#c6c1b5");   // pedestal
      pell(ctx,x+1,y-8,9,4,"#8f8a7e"); pell(ctx,x+1,y-9,7,3,"#bfe6f2"); // basin + water
      dot(ctx,x-1,y-9,"#ffffff");
    }
  }

  /* ---- hawk (predator event) ---- */
  function drawHawk(ctx,x,y,facing,flap){
    const dir=facing>=0?1:-1; x=Math.round(x); y=Math.round(y);
    const body="#5b4326", wing="#6e5234", belly="#c2a373", out="#2b1f12";
    const up=Math.round(Math.sin(flap)*5);
    pell(ctx,x-dir*12,y+1,4,2,body);                                   // tail
    pell(ctx,x-dir*10,y-up,10,3,out); pell(ctx,x-dir*10,y-up,9,2,wing);// far wing
    pell(ctx,x,y,8,5,out); pell(ctx,x,y,7,4,body); pell(ctx,x+dir*1,y+1,4,3,belly);
    pell(ctx,x+dir*6,y-3,3,3,out); pell(ctx,x+dir*6,y-3,3,3,body);     // head
    px(ctx,x+dir*9,y-2,2,1,"#e0b23a"); px(ctx,x+dir*10,y-1,1,1,"#caa024"); // beak
    dot(ctx,x+dir*7,y-3,"#f7e24a");                                   // eye
    pell(ctx,x+dir*10,y-up,10,3,out); pell(ctx,x+dir*10,y-up,9,2,wing);// near wing
  }

  return { L, drawBackground, drawFeeder, drawBird, drawPortrait, drawDecor, drawHawk,
           perchSlots, standHeight, pixelText, pixelTextWidth, shade };
})();

window.Sprites = Sprites;
