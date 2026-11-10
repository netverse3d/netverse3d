'use client';

import { useEffect, useRef, useState } from 'react';
import { Provider, useSelector } from 'react-redux';
import { detectQuality } from '../src/scene/quality.ts';
import { createShopScene, loadShopAssets, type ShopScene } from '../src/scene/shop-scene.ts';
import {
  DEFAULT_RECIPE,
  NO_ROOM,
  errorRaised,
  isQualityLevel,
  nearbySeatChanged,
  qualityRequested,
  recipeRequested,
  recipesLoaded,
  sceneChanged,
  seatingChanged,
  useRequested,
  statsReported,
} from '../src/state/shop-slice.ts';
import { createAppStore, type RootState } from '../src/state/store.ts';
import type { Seat } from '../src/game/seats.ts';
import { createRoomSession, type RoomSession } from '../src/net/room-session.ts';
import Hud from '../src/ui/hud.tsx';
import SeatPrompt from '../src/ui/seat-prompt.tsx';
import { vi } from '../src/ui/text/vi.ts';
import styles from './shop-view.module.css';

const ASSETS_BASE = '/game-assets';
const MOBILE_AGENT = /Android|iPhone|iPad|Mobile/i;
const ROOM_MODE = process.env.NEXT_PUBLIC_ROOM;

async function connectRoom(seats: readonly Seat[]) {
  if (ROOM_MODE !== 'fake') return null;
  const { createFakeRoom } = await import('../dev/fake-room.ts');
  return createFakeRoom(seats.map(({ seatId, footprint }) => ({ seatId, footprint }))).connect();
}

function guestTicket(): string {
  return `guest-${Math.random().toString(36).slice(2, 10)}`;
}

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
    let session: RoomSession | null = null;
    let roomTurn = 0;
    const ticket = guestTicket();
    const openRoom = async () => {
      roomTurn += 1;
      const turn = roomTurn;
      session?.close();
      session = null;
      store.dispatch(seatingChanged(NO_ROOM));
      shop?.setSeating(null, []);
      if (!shop) return;
      const connection = await connectRoom(shop.seats());
      if (!connection) return;
      if (cancelled || turn !== roomTurn) {
        connection.close();
        return;
      }
      store.dispatch(seatingChanged({ ...NO_ROOM, available: true }));
      session = createRoomSession({
        connection,
        shopId: store.getState().shop.scene.recipeId,
        ticket,
        onChange: (view) => {
          store.dispatch(seatingChanged({ ...view, available: true, taken: [...view.taken] }));
          shop?.setSeating(view.seated, view.taken);
        },
      });
    };
    const stopRecipe = listener.startListening({
      actionCreator: recipeRequested,
      effect: (action) => {
        shop?.setRecipe(action.payload);
        void openRoom();
      },
    });
    const stopUse = listener.startListening({
      actionCreator: useRequested,
      effect: () => shop?.use(),
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
          onNearbySeat: (seatId) => store.dispatch(nearbySeatChanged(seatId)),
          onSeatRequest: (seatId, from) => session?.requestSeat(seatId, from),
          onLeaveRequest: () => session?.leaveSeat(),
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
        await openRoom();
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
      stopUse();
      roomTurn += 1;
      session?.close();
      session = null;
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
      <SeatPrompt />
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
