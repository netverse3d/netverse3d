'use client';

import { useDispatch, useSelector } from 'react-redux';
import {
  QUALITY_LEVELS,
  isQualityLevel,
  qualityRequested,
  recipeRequested,
  type SceneState,
} from '../state/shop-slice.ts';
import type { AppDispatch, RootState } from '../state/store.ts';
import styles from './hud.module.css';
import { vi } from './text/vi.ts';

function statusOf(state: SceneState, error: string | null): string {
  if (error) return vi.status.error(error);
  if (state.lost) return vi.status.lost;
  if (!state.ready) return vi.status.loading;
  return state.restored ? vi.status.restored : vi.status.ready;
}

export default function Hud() {
  const dispatch = useDispatch<AppDispatch>();
  const stats = useSelector((state: RootState) => state.shop.stats);
  const scene = useSelector((state: RootState) => state.shop.scene);
  const recipes = useSelector((state: RootState) => state.shop.recipes);
  const error = useSelector((state: RootState) => state.shop.error);
  const warn = Boolean(error) || scene.lost;
  return (
    <div className={styles.hud} role="status">
      <div className={styles.stats}>
        <span>
          {vi.hud.fps}
          <b>{stats.fps}</b>
        </span>
        <span>
          {vi.hud.calls}
          <b>{stats.calls}</b>
        </span>
        <span>
          {vi.hud.triangles}
          <b>{stats.triangles.toLocaleString('vi-VN')}</b>
        </span>
      </div>
      <label className={styles.field}>
        {vi.hud.shop}
        <select
          className={styles.select}
          value={scene.recipeId}
          onChange={(event) => dispatch(recipeRequested(event.target.value))}
        >
          {recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        {vi.hud.quality}
        <select
          className={styles.select}
          value={scene.quality}
          onChange={(event) => {
            if (isQualityLevel(event.target.value)) dispatch(qualityRequested(event.target.value));
          }}
        >
          {QUALITY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {vi.quality[level]}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.status} data-tone={warn ? 'warn' : 'ok'}>
        {statusOf(scene, error)}
      </div>
    </div>
  );
}
