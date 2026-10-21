/* Фон «жидкая медь»: тёмный жидкий металл на WebGL. Логотип рисует отдельный слой. */
(function () {
  var NIK = window.NIK || { reduced: false, coarse: false, onScroll: function () {} };
  var stage = document.querySelector('.hero__stage');
  var canvas = document.createElement('canvas');
  canvas.className = 'liquid';
  stage.appendChild(canvas);
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });

  if (!gl) { stage.classList.add('no-gl'); return; }

  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    'precision highp float;',
    'uniform vec2 uRes;uniform float uT;uniform vec2 uM;uniform float uIn;uniform float uScroll;',
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float n2(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
    ' return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){v+=a*n2(p);p=r*p*2.02;a*=.5;}return v;}',
    'float H(vec2 p){',
    ' float t=uT*.07;',
    ' vec2 q=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,1.3)-t));',
    ' vec2 r=vec2(fbm(p+3.*q+vec2(1.7,9.2)+t*1.3),fbm(p+3.*q+vec2(8.3,2.8)-t));',
    ' float h=fbm(p+3.2*r);',
    ' vec2 d=p-uM; h+=.22*exp(-dot(d,d)*3.)*sin(length(d)*14.-uT*2.2);',
    ' return h;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;',
    ' vec2 p=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y)*.95;',
    ' p.y+=uScroll*.6;',
    ' float e=2./min(uRes.x,uRes.y);',
    ' float h=H(p);',
    ' vec3 n=normalize(vec3(H(p-vec2(e,0.))-H(p+vec2(e,0.)),H(p-vec2(0.,e))-H(p+vec2(0.,e)),e*1.1));',
    ' vec3 v=vec3(0.,0.,1.);',
    ' vec3 L1=normalize(vec3(-.5+.3*sin(uT*.13),.7,.55));',
    ' vec3 L2=normalize(vec3(.8,-.2,.45));',
    ' vec3 r=reflect(-v,n);',
    ' float s1=pow(max(dot(r,L1),0.),36.);',
    ' float s2=pow(max(dot(r,L2),0.),14.);',
    ' float fr=pow(1.-max(n.z,0.),2.2);',
    ' vec3 deep=vec3(.035,.025,.02);',
    ' vec3 cu=vec3(.79,.53,.35);',
    ' vec3 hi=vec3(1.,.85,.68);',
    ' float band=smoothstep(.45,.75,h);',
    ' vec3 col=deep+cu*fr*1.1*(.2+band)+hi*s1*1.1*(.3+band)+cu*s2*.25;',
    ' col+=cu*.06*band;',
    ' float vig=smoothstep(1.25,.25,length((uv-vec2(.5,.56))*vec2(1.,1.25)));',
    ' col*=mix(.25,1.,vig);',
    ' col*=mix(1.,.55,smoothstep(.45,0.,uv.y));',
    ' col*=uIn;',
    ' col=col/(1.+col*.35);',
    ' col=pow(col,vec3(.92));',
    ' gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
  } catch (err) { stage.classList.add('no-gl'); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {}; ['uRes', 'uT', 'uM', 'uIn', 'uScroll'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

  // На телефоне считаем шейдер в уменьшенном разрешении — металл мягкий, разница не видна.
  var scale = NIK.coarse ? 0.5 : Math.min(window.devicePixelRatio || 1, 1.5) * 0.75;
  function resize() {
    var w = stage.clientWidth, h = stage.clientHeight;
    canvas.width = Math.max(2, Math.round(w * scale)); canvas.height = Math.max(2, Math.round(h * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize(); window.addEventListener('resize', resize);

  var mouse = [0, 0], target = [0, 0];
  window.addEventListener('pointermove', function (e) {
    var w = stage.clientWidth, h = stage.clientHeight, m = Math.min(w, h);
    target = [(e.clientX - w / 2) / m * .95, -(e.clientY - h / 2) / m * .95];
  });
  var scrollK = 0;
  NIK.onScroll(function (y) {
    scrollK = Math.min(1, y / window.innerHeight);
  });

  // Металл движется медленно: 30 кадров в секунду (на телефоне 24) достаточно.
  // Если устройство не успевает — снижаем разрешение, а на совсем слабом оставляем один неподвижный кадр.
  var t0 = performance.now(), visible = true, last = 0, step = NIK.coarse ? 41 : 33, slow = 0, n = 0, still = false;
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !still) kick(); }).observe(stage);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !still) kick(); });
  var raf = 0;
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function draw(now) {
    var t = NIK.reduced ? 14 : (now - t0) / 1000;
    mouse[0] += (target[0] - mouse[0]) * 0.05; mouse[1] += (target[1] - mouse[1]) * 0.05;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uT, t + 20);
    gl.uniform2f(U.uM, mouse[0], mouse[1]);
    gl.uniform1f(U.uIn, NIK.reduced || still ? 1 : Math.min(1, t / 1.2));
    gl.uniform1f(U.uScroll, scrollK);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    raf = requestAnimationFrame(frame);
    if (now - last < step) return;
    var dt = last ? now - last : step; last = now;
    if (NIK.reduced) { draw(now); cancelAnimationFrame(raf); raf = 0; return; }
    // оценка: кадр, пришедший сильно позже плана, считается медленным
    if (++n > 8) { slow = slow * 0.9 + (dt > step * 1.9 ? 1 : 0) * 0.1; }
    if (n > 40 && slow > 0.5) {
      if (scale > 0.3) { scale *= 0.6; resize(); slow = 0; n = 8; step = 50; }
      else { still = true; t0 = now - 8000; draw(now); cancelAnimationFrame(raf); raf = 0; return; }
    }
    draw(now);
  }
  NIK.onScroll(function () { if (still) draw(performance.now()); });
  // старт после загрузки страницы — первый экран и текст появляются раньше
  function start() { setTimeout(kick, 120); }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
