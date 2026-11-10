'use client';

import { QUALITY_LEVELS, type QualityLevel } from '../scene/quality.ts';
import type { SceneState, SceneStats } from '../scene/shop-scene.ts';

const QUALITY_LABELS: Record<QualityLevel, string> = { low: 'thấp', medium: 'vừa', high: 'cao' };

export interface HudProps {
  stats: SceneStats;
  state: SceneState;
  recipes: { id: string; name: string }[];
  error: string | null;
  onRecipe: (id: string) => void;
  onQuality: (level: QualityLevel) => void;
}

function statusOf(state: SceneState, error: string | null): string {
  if (error) return `Không vẽ được tiệm: ${error}`;
  if (state.lost) return 'Mất ngữ cảnh WebGL, đang chờ khôi phục';
  if (!state.ready) return 'Đang tải tiệm…';
  return state.restored ? 'Đã dựng lại sau khi mất ngữ cảnh' : 'Sẵn sàng';
}

export default function Hud({ stats, state, recipes, error, onRecipe, onQuality }: HudProps) {
  const warn = Boolean(error) || state.lost;
  return (
    <div className="hud" role="status">
      <div className="stats">
        <span>
          FPS<b>{stats.fps}</b>
        </span>
        <span>
          lời gọi vẽ<b>{stats.calls}</b>
        </span>
        <span>
          tam giác<b>{stats.triangles.toLocaleString('vi-VN')}</b>
        </span>
      </div>
      <label>
        Tiệm
        <select value={state.recipeId} onChange={(event) => onRecipe(event.target.value)}>
          {recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Chất lượng
        <select
          value={state.quality}
          onChange={(event) => onQuality(event.target.value as QualityLevel)}
        >
          {QUALITY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {QUALITY_LABELS[level]}
            </option>
          ))}
        </select>
      </label>
      <div className="status" data-tone={warn ? 'warn' : 'ok'}>
        {statusOf(state, error)}
      </div>
    </div>
  );
}
