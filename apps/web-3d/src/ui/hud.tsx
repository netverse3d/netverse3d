'use client';

import { Panel, SelectField, Text } from '@netverse/ui/react';
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
    <Panel
      as="div"
      className={styles.hud}
      role="status"
      shape="notch"
      cut="sm"
      tone="cyan"
      duo="magenta"
    >
      <div className={styles.stats}>
        <Text as="span" variant="meta">
          {vi.hud.fps}{' '}
          <Text as="strong" variant="value">
            {stats.fps}
          </Text>
        </Text>
        <Text as="span" variant="meta">
          {vi.hud.calls}{' '}
          <Text as="strong" variant="value">
            {stats.calls}
          </Text>
        </Text>
        <Text as="span" variant="meta">
          {vi.hud.triangles}{' '}
          <Text as="strong" variant="value">
            {stats.triangles.toLocaleString('vi-VN')}
          </Text>
        </Text>
      </div>
      <div className={styles.fields}>
        <SelectField
          label={vi.hud.shop}
          value={scene.recipeId}
          options={recipes.map((recipe) => ({ value: recipe.id, label: recipe.name }))}
          onChange={(event) => {
            dispatch(recipeRequested(event.target.value));
            event.target.blur();
          }}
        />
        <SelectField
          label={vi.hud.quality}
          value={scene.quality}
          options={QUALITY_LEVELS.map((level) => ({ value: level, label: vi.quality[level] }))}
          onChange={(event) => {
            if (isQualityLevel(event.target.value)) dispatch(qualityRequested(event.target.value));
          }}
        />
      </div>
      <Text variant="meta" tone={warn ? 'error' : 'info'}>
        {statusOf(scene, error)}
      </Text>
    </Panel>
  );
}
