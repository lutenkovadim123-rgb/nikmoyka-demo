/* Фон первого экрана «жидкое золото»: лёгкий шейдер WebGL.
   Экономия: считаем в уменьшенном разрешении (металл мягкий — разницы не видно), 30 кадров (на телефоне 24),
   пауза вне экрана и в скрытой вкладке; если устройство не успевает — снижаем разрешение, затем оставляем неподвижный кадр.
   Без WebGL и при «уменьшить движение» остаётся CSS-градиент (класс .hero--still). */
(function () {
  'use strict';
  var hero = document.querySelector('.hero'); if (!hero) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var cv = document.createElement('canvas'); cv.className = 'hero__gold'; cv.setAttribute('aria-hidden', 'true');
  var gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) { hero.classList.add('hero--still'); return; }
  var dx = null; // производные экрана дают «квадратики» при уменьшенном разрешении — нормаль считаем разностями
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = (dx ? '#extension GL_OES_standard_derivatives : enable\n' : '') + [
    'precision mediump float;',
    'uniform vec2 R;uniform float T;',
    'float h(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+19.19);return fract(p.x*p.y);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
    'float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return v;}',
    'float H(vec2 p){float t=T*.05;vec2 q=vec2(fb(p+vec2(0.,t)),fb(p+vec2(4.3,1.7)-t));return fb(p+2.6*q+vec2(t*.7,-t*.4));}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/R;vec2 p=(gl_FragCoord.xy-.5*R)/min(R.x,R.y)*1.2;',
    ' float v=H(p);',
    dx ? ' vec3 nn=normalize(vec3(-dFdx(v),-dFdy(v),3./min(R.x,R.y)));' : ' float e=.018;vec3 nn=normalize(vec3(H(p-vec2(e,0.))-v,H(p-vec2(0.,e))-v,e*1.1));',
    ' vec3 L=normalize(vec3(-.4+.25*sin(T*.11),.6,.7));vec3 r=reflect(vec3(0.,0.,-1.),nn);',
    ' float sp=pow(max(dot(r,L),0.),24.),fr=pow(1.-max(nn.z,0.),1.6);',
    ' vec3 deep=vec3(.05,.035,.02),gold=vec3(.78,.55,.27),hi=vec3(1.,.88,.62);',
    ' float b=smoothstep(.35,.8,v);',
    ' vec3 c=deep+gold*(fr*1.2+b*.35)+hi*sp*(.5+b);',
    ' c*=mix(.32,1.,smoothstep(1.2,.2,length((uv-vec2(.5,.55))*vec2(1.,1.3))));',
    ' c*=mix(1.,.45,smoothstep(.5,0.,uv.y));',
    ' c=c/(1.+c*.3);gl_FragColor=vec4(c,1.);}'
  ].join('\n');
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
  var pr;
  try { pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw 0; }
  catch (e) { hero.classList.add('hero--still'); return; }
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T');
  hero.insertBefore(cv, hero.firstChild);
  var scale = coarse ? 0.42 : 0.45;
  function size() { cv.width = Math.max(2, Math.round(hero.clientWidth * scale)); cv.height = Math.max(2, Math.round(hero.clientHeight * scale)); gl.viewport(0, 0, cv.width, cv.height); }
  size(); window.addEventListener('resize', function () { size(); draw(performance.now()); });
  var t0 = performance.now() - 20000, step = coarse ? 41 : 33, last = 0, slow = 0, n = 0, still = reduced, raf = 0, vis = true;
  function draw(now) { gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, (now - t0) / 1000); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  function frame(now) {
    raf = 0; if (!vis || document.hidden || still) return;
    raf = requestAnimationFrame(frame);
    if (now - last < step) return;
    var dt = last ? now - last : step; last = now;
    if (++n > 10) slow = slow * 0.9 + (dt > step * 2 ? 0.1 : 0);
    if (n > 50 && slow > 0.5) { if (scale > 0.22) { scale *= 0.7; size(); slow = 0; n = 10; step = 50; } else { still = true; } }
    draw(now);
  }
  function kick() { if (!raf && !still) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(function (es) { vis = es[0].isIntersecting; kick(); }).observe(hero);
  document.addEventListener('visibilitychange', kick);
  draw(performance.now()); cv.classList.add('on');
  // анимация стартует после загрузки страницы — первый экран показывается сразу
  if (document.readyState === 'complete') setTimeout(kick, 200); else window.addEventListener('load', function () { setTimeout(kick, 200); });
})();
