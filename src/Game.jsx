import React, { useEffect, useRef, useState } from "react";

/**
 * - Fixed-timestep physics (1/60s)
 * Controls:
 *  Space / ArrowUp -> jump
 *  ArrowDown -> duck
 *  R -> restart
 */


// TODO sprites - piwwos (ground), megatron? (air)



const GRAVITY = 2200; // px/s^2
const JUMP = -600; // px/s initial jump velocity
const GROUND_Y = 200;
const BASE_SPEED = 300; // px/s

const WINDOW_WIDTH = 800;
const WINDOW_HEIGHT = 260;


export default function Game() {
  const canvasRef = useRef(null);

  const [gameOver, setGameOver] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);

  const S = useRef({
    running: true,
    gravity: GRAVITY, 
    jumpImpulse: JUMP,
    groundY: GROUND_Y,
    speed: BASE_SPEED,
    score: 0,
    player: null,
    obstacles: [],
    clouds: [],
    groundOffset: 0,
  });

  // images
  const imgs = useRef({
    dino: null,
    dinoDuck: null,
    bird: null,
    cactus: null,
    ground: null,
    cloud: null,
  });

  // Animation frame timing (independent of physics)
  const anim = useRef({
    dinoFrame: 0,
    dinoTimer: 0,
    dinoFrameDur: 1 / 10,
    duckFrame: 0,
    duckTimer: 0,
    duckFrameDur: 1 / 10,
    birdFrame: 0,
    birdTimer: 0,
    birdFrameDur: 1 / 10,
  });

  // util to load image (resolves to image or null on error)
  const loadImage = (src) =>
    new Promise((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = src;
    });

  useEffect(() => {
    let rafId = null;
    let lastTime = performance.now();
    const FIXED_STEP = 1 / 60; // physics tick (seconds)
    const MAX_ACCUM = 0.25; // clamp delta

    // set canvas logical size
    const canvas = canvasRef.current;
    canvas.width = WINDOW_WIDTH;
    canvas.height = WINDOW_HEIGHT;

    // load images first
    (async () => {
      imgs.current.dino = (await loadImage(`${import.meta.env.BASE_URL}sprites/dino.png`)) || null;
      imgs.current.dinoDuck = (await loadImage(`${import.meta.env.BASE_URL}sprites/dino_duck.png`)) || null;
      imgs.current.bird = (await loadImage(`${import.meta.env.BASE_URL}sprites/bird.png`)) || null;
      imgs.current.cactus = (await loadImage(`${import.meta.env.BASE_URL}sprites/cactus.png`)) || null;
      imgs.current.ground = (await loadImage(`${import.meta.env.BASE_URL}sprites/ground.png`)) || null;
      imgs.current.cloud = (await loadImage(`${import.meta.env.BASE_URL}sprites/cloud.png`)) || null;

      initEntities();
      startLoop();
    })();

    // initialize player, obstacles
    function initEntities() {
      const s = S.current;
      s.running = true;
      s.obstacles = [];
      s.clouds = [];
      s.groundOffset = 0;
      s.speed = BASE_SPEED;
      s.score = 0;
      s._spawnTimer = 0;
      s._lastSpeedTick = 0;

      s.player = {
        x: 50,
        y: s.groundY,
        vx: 0,
        vy: 0,
        standingW: 30,
        standingH: 48,
        duckW: 30,
        duckH: 32,
        width: 30,
        height: 48,
        grounded: true,
        ducking: false,
        spriteStand: imgs.current.dino,
        spriteDuck: imgs.current.dinoDuck,
      };

      // initial clouds
      s.clouds.push({ x: 300, y: 40, w: 46, h: 13, sprite: imgs.current.cloud });
      s.clouds.push({ x: 700, y: 70, w: 46, h: 13, sprite: imgs.current.cloud });

      // reset animations
      anim.current = {
        dinoFrame: 0,
        dinoTimer: 0,
        dinoFrameDur: 1 / 10,
        duckFrame: 0,
        duckTimer: 0,
        duckFrameDur: 1 / 10,
        birdFrame: 0,
        birdTimer: 0,
        birdFrameDur: 1 / 10,
      };

      setGameOver(false);
      setDisplayScore(0);
    }

    // spawn cactus or bird
    function spawnObstacle() {
      const s = S.current;
      const r = Math.random();
      if (r < 0.72) {
        const baseW = 17;
        const baseH = 35;
        // random scale (1x to 1.6x)
        const scale = 1 + Math.random() * 0.6;
        s.obstacles.push({
          type: "cactus",
          x: canvas.width + 30,
          y: s.groundY,
          w: Math.round(baseW * scale),
          h: Math.round(baseH * scale),
          sprite: imgs.current.cactus,
          spriteW: baseW,
          spriteH: baseH,
        });
      } else {
        const birdHeights = [s.groundY - 30, s.groundY - 60, s.groundY - 90];
        const y = birdHeights[Math.floor(Math.random() * birdHeights.length)];
        s.obstacles.push({
          type: "bird",
          x: canvas.width + 40,
          y,
          w: 46,
          h: 40,
          sprite: imgs.current.bird,
          spriteW: 46,
          spriteH: 40,
          flap: 0,
        });
      }
    }

    // Fixed physics update (dt seconds)
    function fixedUpdate(dt) {
      const s = S.current;
      const p = s.player;

      // apply gravity
      p.vy += s.gravity * dt;
      p.y += p.vy * dt;

      // ground collision
      if (p.y > s.groundY) {
        p.y = s.groundY;
        p.vy = 0;
        p.grounded = true;
      }

      // obstacles move left
      for (const o of s.obstacles) {
        o.x -= s.speed * dt;
        if (o.type === "bird") {
          // keep flap counter but actual frame handled in anim update
          o.flap = (o.flap + 1) % 2;
        }
      }
      s.obstacles = s.obstacles.filter((o) => o.x + o.w > -50);

      // clouds move slower
      for (const c of s.clouds) {
        c.x -= s.speed * 0.18 * dt;
      }
      s.clouds = s.clouds.filter((c) => c.x + c.w > -50);

      // ground offset
      s.groundOffset = (s.groundOffset - s.speed * dt) % canvas.width;

      // score increases based on time (consistent across machines)
      s.score += 60 * dt; // roughly 60 points per second base
      s._spawnTimer = (s._spawnTimer || 0) + dt;

      // spawn interval depends on score (difficulty)
      const spawnInterval = Math.max(0.7, 1.6 - Math.min(1.2, s.score / 600));
      if (s._spawnTimer > spawnInterval) {
        spawnObstacle();
        s._spawnTimer = 0;
      }

      // difficulty scaling once per 500 points
      if (Math.floor(s.score) % 500 === 0 && Math.floor(s.score) !== 0) {
        if (!s._lastSpeedTick || Math.floor(s.score) - s._lastSpeedTick >= 500) {
          s.speed += 20;
          s._lastSpeedTick = Math.floor(s.score);
        }
      }

      // collisions (use smaller hitboxes)
      const playerDrawW = p.ducking ? p.duckW : p.standingW;
      const playerDrawH = p.ducking ? p.duckH : p.standingH;
      // top-left coord for drawing:
      const playerDrawX = p.x; // anchored bottom-left
      const playerDrawY = p.y - playerDrawH;

      const playerBox = {
        x: playerDrawX + 8,
        y: playerDrawY + 6,
        w: playerDrawW - 16,
        h: playerDrawH - 10,
      };

      for (const o of s.obstacles) {
        const obstacleBox = {
          x: o.x + 4,
          y: o.y - o.h + 4,
          w: o.w - 8,
          h: o.h - 6,
        };

        // if player is ducking, tighten vertical hitbox more (player is lower)
        if (p.ducking) {
          playerBox.y += 6;
          playerBox.h = Math.max(8, playerBox.h - 6);
        }

        if (
          playerBox.x < obstacleBox.x + obstacleBox.w &&
          playerBox.x + playerBox.w > obstacleBox.x &&
          playerBox.y < obstacleBox.y + obstacleBox.h &&
          playerBox.y + playerBox.h > obstacleBox.y
        ) {
          // collision detected
          s.running = false;
          S.current.running = false;
          setGameOver(true);
        }
      }

      // update UI score display occasionally (throttle)
      S.current._scoreDelta = (S.current._scoreDelta || 0) + dt;
      if (S.current._scoreDelta >= 0.1) {
        setDisplayScore(Math.floor(s.score));
        S.current._scoreDelta = 0;
      }
    }

    // Render everything
    function render() {
      const s = S.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      canvas.style.imageRendering = "pixelated";
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // background
      ctx.fillStyle = "#f7f7f7";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // clouds
      for (const c of s.clouds) {
        if (c.sprite && c.sprite.width) {
          ctx.drawImage(c.sprite, c.x, c.y, c.w, c.h);
        } else {
          ctx.fillStyle = "#e3e3e3";
          ctx.fillRect(c.x, c.y, c.w, c.h);
        }
      }

      // ground (draw twice for wrap)
      if (imgs.current.ground && imgs.current.ground.width) {
        const gw = canvas.width;
        ctx.drawImage(imgs.current.ground, s.groundOffset, s.groundY-15, gw, 20);
        ctx.drawImage(imgs.current.ground, s.groundOffset + gw, s.groundY-15, gw, 20);
      } else {
        ctx.fillStyle = "#333";
        ctx.fillRect(0, s.groundY + 10, canvas.width, 4);
      }

      // obstacles
      for (const o of s.obstacles) {
        if (o.sprite && o.sprite.width) {
          if (o.type === "bird") {
            // bird sprite sheet of 2 frames horizontally (46x40 each)
            const frameIndex = anim.current.birdFrame % 2;
            const sx = frameIndex * o.spriteW;
            ctx.drawImage(o.sprite, sx, 0, o.spriteW, o.spriteH, o.x, o.y - o.h, o.w, o.h);
          } else {
            // cactus (single image) - draw scaled to o.w x o.h
            ctx.drawImage(o.sprite, 0, 0, o.spriteW, o.spriteH, o.x, o.y - o.h, o.w, o.h);
          }
        } else {
          ctx.fillStyle = o.type === "bird" ? "#222" : "#127a13";
          ctx.fillRect(o.x, o.y - o.h, o.w, o.h);
        }
      }

      // player draw (anchored bottom-left at p.x, p.y)
      const p = s.player;
      if (p.ducking) {
        // duck uses dino_duck.png sheet 2 frames, unit 59x30
        const duckFrameIndex = anim.current.duckFrame % 2;
        if (imgs.current.dinoDuck && imgs.current.dinoDuck.width) {
          const sx = duckFrameIndex * p.duckW;
          // bottom-left anchor: draw with x = p.x, y = p.y - duckH
          ctx.drawImage(
            imgs.current.dinoDuck,
            sx,
            0,
            p.duckW,
            p.duckH,
            p.x,
            p.y - p.duckH,
            p.duckW,
            p.duckH
          );
        } else {
          // fallback rect
          ctx.fillStyle = "#111";
          ctx.fillRect(p.x, p.y - p.duckH, p.duckW, p.duckH);
        }
      } else {
        // standing / running: dino.png 5 frames, 44x47 each
        const runFrameIndex = anim.current.dinoFrame % 2;
        if (imgs.current.dino && imgs.current.dino.width) {
          const sx = runFrameIndex * p.standingW;
          ctx.drawImage(
            imgs.current.dino,
            sx,
            0,
            p.standingW,
            p.standingH,
            p.x,
            p.y - p.standingH,
            p.standingW,
            p.standingH
          );
        } else {
          ctx.fillStyle = "#111";
          ctx.fillRect(p.x, p.y - p.standingH, p.standingW, p.standingH);
        }
      }

      // hitbox
      // const playerDrawW = p.ducking ? p.duckW : p.standingW;
      // const playerDrawH = p.ducking ? p.duckH : p.standingH;
      // ctx.strokeStyle = "rgba(255,0,0,0.6)";
      // ctx.strokeRect(p.x + 8, p.y - playerDrawH + 6, playerDrawW - 16, playerDrawH - 10);

      // HUD
      ctx.fillStyle = "#222";
      ctx.font = "18px monospace";
      ctx.fillText(`Score: ${Math.floor(s.score)}`, canvas.width - 140, 28);
    }

    // animation timers update (called each frame with dt)
    function updateAnimations(dt) {
      // Dino run anim only when on-ground and not ducking
      const a = anim.current;
      const p = S.current.player;

      if (p && !p.ducking && p.grounded) {
        a.dinoTimer += dt;
        if (a.dinoTimer >= a.dinoFrameDur) {
          a.dinoTimer -= a.dinoFrameDur;
          a.dinoFrame = (a.dinoFrame + 1) % 2;
        }
      } else {
        // jumping
        if (!p.grounded) {
          a.dinoFrame = 1;
        }
      }

      // ducking anim only if ducking
      if (p && p.ducking) {
        a.duckTimer += dt;
        if (a.duckTimer >= a.duckFrameDur) {
          a.duckTimer -= a.duckFrameDur;
          a.duckFrame = (a.duckFrame + 1) % 2;
        }
      } else {
        a.duckFrame = 0;
        a.duckTimer = 0;
      }

      // bird flap
      a.birdTimer += dt;
      if (a.birdTimer >= a.birdFrameDur) {
        a.birdTimer -= a.birdFrameDur;
        a.birdFrame = (a.birdFrame + 1) % 2;
      }
    }

    // main loop with accumulator fixed timestep
    function startLoop() {
      let acc = 0;
      lastTime = performance.now();

      function loop(now) {
        rafId = requestAnimationFrame(loop);
        if (!S.current.running) {
          cancelAnimationFrame(rafId);
          return;
        }
        let delta = (now - lastTime) / 1000;
        lastTime = now;
        if (delta > MAX_ACCUM) delta = MAX_ACCUM;
        acc += delta;

        // run fixed physics steps
        while (acc >= FIXED_STEP) {
          fixedUpdate(FIXED_STEP);
          acc -= FIXED_STEP;
        }

        // update animations with actual delta for smoothness
        updateAnimations(delta);

        // render once per frame
        render();
      }

      rafId = requestAnimationFrame(loop);
    }

    // input handlers
    function onKeyDown(e) {
      const s = S.current;

      if (e.code === "KeyR") {
        // restart if not running
        if (!s.running) {
          initEntities();
          s.running = true;
          startLoop();
          return;
        }
      }
      
      if (!s.running) return;
      const p = s.player;
      if (!p) return;

      if (e.code === "Space" || e.code === "ArrowUp") {
        // jump only when grounded and not ducking
        if (p.grounded && !p.ducking) {
          p.vy = s.jumpImpulse;
          p.grounded = false;
        }
      }
      if (e.code === "ArrowDown") {
        // start duck only when grounded
        if (p.grounded) {
          p.ducking = true;
          p.height = p.duckH;
        }
      }

    }
    function onKeyUp(e) {
      const s = S.current;
      const p = s.player;
      if (!p) return;
      if (e.code === "ArrowDown") {
        // stop duck
        p.ducking = false;
        p.height = p.standingH;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // cleanup on unmount
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  return (
    <div style={{ width: 800, maxWidth: "96vw", margin: "0 auto" }}>
      <div style={{ position: "relative" }}>
        <canvas ref={canvasRef} style={{ width: "100%", display: "block", border: "2px solid #333" }} />
      </div>

      <div style={{ marginTop: 12, textAlign: "center" }}>
        {gameOver ? (
          <>
            <h3 style={{ margin: 0 }}>Game Over</h3>
            <p style={{ margin: 4 }}>
              Press R to restart
            </p>
          </>
        ) : (
          <>
            <h3 style={{ margin: 0,color:'#ffffff00' }}>-</h3>
            <p style={{ margin: 4,color:'#ffffff00' }}>
              -
            </p>
          </>
        )}
      </div>
    </div>
  );
}
