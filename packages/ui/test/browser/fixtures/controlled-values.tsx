import '../../../tokens/index.css';
import '../../../components/components.css';
import { createRoot } from 'react-dom/client';
import { useSyncExternalStore } from 'react';
import {
  ColorSwatch,
  ItemGrid,
  NumberStepper,
  SegmentedControl,
  Slider,
} from '../../../react/index.ts';

type Control = { controlled: boolean; value: string | number };

const controls: Record<string, Control> = {
  segmented: { controlled: true, value: 'day' },
  swatch: { controlled: true, value: 'cyan' },
  grid: { controlled: true, value: 'cap' },
  slider: { controlled: true, value: 160 },
  stepper: { controlled: true, value: 2 },
};
const listeners = new Set<() => void>();
let revision = 0;

function publish() {
  revision += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useControl<T extends string | number>(id: string): T | undefined {
  useSyncExternalStore(subscribe, () => revision);
  const control = controls[id];
  return control?.controlled ? (control.value as T) : undefined;
}

Object.assign(window, {
  fixture: {
    revision: () => revision,
    control(id: string, value: string | number) {
      controls[id] = { controlled: true, value };
      publish();
    },
    release(id: string) {
      const control = controls[id];
      if (control) controls[id] = { ...control, controlled: false };
      publish();
    },
  },
});

function Fixture() {
  const rendered = useSyncExternalStore(subscribe, () => revision);
  return (
    <main data-revision={rendered}>
      <section data-fixture="segmented">
        <SegmentedControl
          label="Time"
          value={useControl<string>('segmented')}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'night', label: 'Night' },
          ]}
        />
      </section>
      <section data-fixture="swatch">
        <ColorSwatch
          label="Color"
          value={useControl<string>('swatch')}
          options={[
            { value: 'cyan', color: '#00e5ff', label: 'Cyan' },
            { value: 'pink', color: '#ff4fd8', label: 'Pink' },
          ]}
        />
      </section>
      <section data-fixture="grid">
        <ItemGrid
          label="Items"
          lockedLabel="Locked"
          value={useControl<string>('grid')}
          items={[
            { id: 'cap', label: 'Cap' },
            { id: 'scarf', label: 'Scarf' },
          ]}
        />
      </section>
      <section data-fixture="slider">
        <Slider label="Height" min={150} max={190} value={useControl<number>('slider')} />
      </section>
      <section data-fixture="stepper">
        <NumberStepper
          label="Hours"
          decreaseLabel="Fewer"
          increaseLabel="More"
          min={1}
          max={8}
          value={useControl<number>('stepper')}
        />
      </section>
    </main>
  );
}

const container = document.getElementById('root');
if (container) createRoot(container).render(<Fixture />);
