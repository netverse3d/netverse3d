'use client';

import { useEffect, useRef, useState } from 'react';
import { detectQuality, isQualityLevel } from '../scene/quality.ts';
import {
  createShopScene,
  loadShopAssets,
  type SceneState,
  type SceneStats,
  type ShopScene,
} from '../scene/shop-scene.ts';
import Hud from './hud.tsx';

const ASSETS_BASE = '/game-assets';
const DEFAULT_RECIPE = 'tim-neon';
const MOBILE_AGENT = /Android|iPhone|iPad|Mobile/i;

function pickRecipe(ids: string[], requested: string | null): string {
  if (requested && ids.includes(requested)) return requested;
  if (ids.includes(DEFAULT_RECIPE)) return DEFAULT_RECIPE;
  return ids[0] ?? DEFAULT_RECIPE;
}

export default function ShopView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ShopScene | null>(null);
  const [recipes, setRecipes] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SceneStats>({ fps: 0, calls: 0, triangles: 0 });
  const [state, setState] = useState<SceneState>({
    recipeId: DEFAULT_RECIPE,
    quality: 'medium',
    ready: false,
    face: false,
    rebuilds: 0,
    restored: false,
    lost: false,
  });

  useEffect(() => {
    let scene: ShopScene | null = null;
    let cancelled = false;
    (async () => {
      try {
        const assets = await loadShopAssets(ASSETS_BASE);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        setRecipes(assets.ids.map((id) => ({ id, name: assets.recipes[id]?.name ?? id })));
        const params = new URLSearchParams(window.location.search);
        scene = createShopScene({
          canvas,
          assets,
          recipeId: pickRecipe(assets.ids, params.get('shop')),
          quality: 'medium',
          onStats: setStats,
          onState: setState,
        });
        sceneRef.current = scene;
        const requested = params.get('quality');
        scene.setQuality(
          isQualityLevel(requested)
            ? requested
            : detectQuality({
                hardwareConcurrency: navigator.hardwareConcurrency,
                devicePixelRatio: window.devicePixelRatio,
                mobile: MOBILE_AGENT.test(navigator.userAgent),
                renderer: scene.rendererName(),
              }),
        );
        if (params.get('probe') === 'context-loss') scene.simulateContextLoss();
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();
    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div
      id="stage"
      data-ready={String(state.ready)}
      data-face={String(state.face)}
      data-recipe={state.recipeId}
      data-rebuilds={state.rebuilds}
      data-restored={String(state.restored)}
      data-quality={state.quality}
    >
      <canvas id="gl" ref={canvasRef} aria-label="Tiệm net 3D" />
      <Hud
        stats={stats}
        state={state}
        recipes={recipes}
        error={error}
        onRecipe={(id) => sceneRef.current?.setRecipe(id)}
        onQuality={(level) => sceneRef.current?.setQuality(level)}
      />
    </div>
  );
}
