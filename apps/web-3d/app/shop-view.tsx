'use client';

import { useEffect, useRef, useState } from 'react';
import { Provider, useSelector } from 'react-redux';
import { detectQuality } from '../src/scene/quality.ts';
import { createShopScene, loadShopAssets, type ShopScene } from '../src/scene/shop-scene.ts';
import {
  DEFAULT_RECIPE,
  errorRaised,
  isQualityLevel,
  qualityRequested,
  recipeRequested,
  recipesLoaded,
  sceneChanged,
  statsReported,
} from '../src/state/shop-slice.ts';
import { createAppStore, type RootState } from '../src/state/store.ts';
import Hud from '../src/ui/hud.tsx';
import { vi } from '../src/ui/text/vi.ts';
import styles from './shop-view.module.css';

const ASSETS_BASE = '/game-assets';
const MOBILE_AGENT = /Android|iPhone|iPad|Mobile/i;

function pickRecipe(ids: string[], requested: string | null): string {
  if (requested && ids.includes(requested)) return requested;
  if (ids.includes(DEFAULT_RECIPE)) return DEFAULT_RECIPE;
  return ids[0] ?? DEFAULT_RECIPE;
}

function ShopStage({ app }: { app: ReturnType<typeof createAppStore> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useSelector((state: RootState) => state.shop.scene);

  useEffect(() => {
    const { store, listener } = app;
    let shop: ShopScene | null = null;
    let cancelled = false;
    const stopRecipe = listener.startListening({
      actionCreator: recipeRequested,
      effect: (action) => shop?.setRecipe(action.payload),
    });
    const stopQuality = listener.startListening({
      actionCreator: qualityRequested,
      effect: (action) => shop?.setQuality(action.payload),
    });
    (async () => {
      try {
        const assets = await loadShopAssets(ASSETS_BASE);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        store.dispatch(
          recipesLoaded(assets.ids.map((id) => ({ id, name: assets.recipes[id]?.name ?? id }))),
        );
        const params = new URLSearchParams(window.location.search);
        shop = createShopScene({
          canvas,
          assets,
          recipeId: pickRecipe(assets.ids, params.get('shop')),
          quality: 'medium',
          onStats: (stats) => store.dispatch(statsReported(stats)),
          onState: (state) => store.dispatch(sceneChanged(state)),
          onError: (message) => store.dispatch(errorRaised(message)),
        });
        const requested = params.get('quality');
        shop.setQuality(
          isQualityLevel(requested)
            ? requested
            : detectQuality({
                hardwareConcurrency: navigator.hardwareConcurrency,
                devicePixelRatio: window.devicePixelRatio,
                mobile: MOBILE_AGENT.test(navigator.userAgent),
                renderer: shop.rendererName(),
              }),
        );
        if (params.get('probe') === 'context-loss') shop.simulateContextLoss();
      } catch (reason) {
        if (!cancelled) {
          store.dispatch(errorRaised(reason instanceof Error ? reason.message : String(reason)));
        }
      }
    })();
    return () => {
      cancelled = true;
      stopRecipe();
      stopQuality();
      shop?.dispose();
      shop = null;
    };
  }, [app]);

  return (
    <div
      id="stage"
      className={styles.stage}
      data-ready={String(scene.ready)}
      data-face={String(scene.face)}
      data-recipe={scene.recipeId}
      data-rebuilds={scene.rebuilds}
      data-frames={scene.frames}
      data-restored={String(scene.restored)}
      data-quality={scene.quality}
    >
      <canvas id="gl" className={styles.canvas} ref={canvasRef} aria-label={vi.app.stageLabel} />
      <Hud />
    </div>
  );
}

export default function ShopView() {
  const [app] = useState(() => createAppStore());
  return (
    <Provider store={app.store}>
      <ShopStage app={app} />
    </Provider>
  );
}
