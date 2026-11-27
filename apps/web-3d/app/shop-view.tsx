'use client';

import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { detectQuality } from '../src/scene/quality.ts';
import { createShopScene, loadShopAssets, type ShopScene } from '../src/scene/shop-scene.ts';
import {
  DEFAULT_RECIPE,
  NO_ROOM,
  errorRaised,
  isQualityLevel,
  nearbySeatChanged,
  qualityRequested,
  rentalConfirmationCancelled,
  rentalConfirmationRequested,
  seatLeaveRequested,
  recipeRequested,
  recipesLoaded,
  sceneChanged,
  seatingChanged,
  sessionChanged,
  sessionEnded,
  useRequested,
  statsReported,
} from '../src/state/shop-slice.ts';
import type { createAppStore, RootState } from '../src/state/store.ts';
import type { Seat } from '../src/game/seats.ts';
import { createRoomSession, type RoomSession } from '../src/net/room-session.ts';
import { connectSeatRequests } from '../src/game/seat-requests.ts';
import Hud from '../src/ui/hud.tsx';
import RecoveryOverlay from '../src/ui/recovery-overlay.tsx';
import SeatPrompt from '../src/ui/seat-prompt.tsx';
import SeatDesktop from '../src/ui/seat-desktop.tsx';
import { applyInterfaceTheme, readThemePalette } from '../src/ui/interface-theme.ts';
import { vi } from '../src/ui/text/vi.ts';
import styles from './shop-view.module.css';

const ASSETS_BASE = '/game-assets';
const MOBILE_AGENT = /Android|iPhone|iPad|Mobile/i;
const ROOM_MODE = process.env.NEXT_PUBLIC_ROOM;

async function connectRoom(seats: readonly Seat[]) {
  if (ROOM_MODE !== 'fake') return null;
  const requestedSeconds = Number(new URLSearchParams(window.location.search).get('session'));
  const sessionSeconds =
    Number.isSafeInteger(requestedSeconds) && requestedSeconds > 0 ? requestedSeconds : undefined;
  const { createFakeRoom } = await import('../dev/fake-room.ts');
  return createFakeRoom(
    seats.map(({ seatId, footprint }) => ({ seatId, footprint })),
    sessionSeconds === undefined ? {} : { sessionSeconds },
  ).createConnection();
}

function guestTicket(): string {
  return `guest-${Math.random().toString(36).slice(2, 10)}`;
}

function pickRecipe(ids: string[], requested: string | null): string {
  if (requested && ids.includes(requested)) return requested;
  if (ids.includes(DEFAULT_RECIPE)) return DEFAULT_RECIPE;
  return ids[0] ?? DEFAULT_RECIPE;
}

export default function ShopView({ app }: { app: ReturnType<typeof createAppStore> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useSelector((state: RootState) => state.shop.scene);
  const nearbySeat = useSelector((state: RootState) => state.shop.nearbySeat);
  const seating = useSelector((state: RootState) => state.shop.seating);
  const recipes = useSelector((state: RootState) => state.shop.recipes);

  useEffect(() => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const palette = readThemePalette((name) => computed.getPropertyValue(name));
    const accent = recipes.find((recipe) => recipe.id === scene.recipeId)?.accent ?? null;
    return applyInterfaceTheme(root, { quality: scene.quality, accent }, palette);
  }, [scene.quality, scene.recipeId, recipes]);
  const [lightingId, setLightingId] = useState('');

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
      store.dispatch(rentalConfirmationCancelled());
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
          store.dispatch(
            seatingChanged({
              available: true,
              seated: view.seated,
              taken: [...view.taken],
              denied: view.denied,
              error: view.error,
            }),
          );
          store.dispatch(sessionChanged(view.session));
          if (view.ended) store.dispatch(sessionEnded(view.ended.reason));
          shop?.setSeating(view.seated, view.taken);
        },
      });
    };
    const stopRecipe = listener.startListening({
      actionCreator: recipeRequested,
      effect: (action) => {
        const before = store.getState().shop.scene.recipeId;
        shop?.setRecipe(action.payload);
        setLightingId(shop?.lightingPresetId() ?? '');
        if (store.getState().shop.scene.recipeId === before) return;
        openRoom().catch((reason: unknown) => {
          store.dispatch(errorRaised(reason instanceof Error ? reason.message : String(reason)));
        });
      },
    });
    const stopUse = listener.startListening({
      actionCreator: useRequested,
      effect: () => shop?.use(),
    });
    const stopSeatRequests = connectSeatRequests(listener, () => session);
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
          recipesLoaded(
            assets.ids.map((id) => ({
              id,
              name: assets.recipes[id]?.name ?? id,
              accent: assets.recipes[id]?.palette.accent?.[0],
            })),
          ),
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
          onSeatRequest: (seatId, from) => {
            if (session) store.dispatch(rentalConfirmationRequested({ seatId, from }));
          },
          onLeaveRequest: () => store.dispatch(seatLeaveRequested()),
        });
        setLightingId(shop.lightingPresetId());
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
      stopSeatRequests();
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
      data-nearby-seat={nearbySeat ?? ''}
      data-room-available={String(seating.available)}
      data-session-seat={seating.seated ?? ''}
      data-seat-ready={String(scene.seatReady)}
      data-lighting={lightingId}
      data-rebuilds={scene.rebuilds}
      data-frames={scene.frames}
      data-restored={String(scene.restored)}
      data-quality={scene.quality}
    >
      <canvas id="gl" className={styles.canvas} ref={canvasRef} aria-label={vi.app.stageLabel} />
      <Hud />
      <SeatPrompt />
      <SeatDesktop />
      <RecoveryOverlay />
    </div>
  );
}
