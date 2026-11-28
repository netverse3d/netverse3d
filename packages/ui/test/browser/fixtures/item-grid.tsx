import '../../../tokens/index.css';
import '../../../components/components.css';
import { createRoot } from 'react-dom/client';
import { ItemGrid } from '../../../react/index.ts';

const ITEMS = Array.from({ length: 10 }, (_, index) => ({
  id: `item-${index}`,
  label: `Item ${index}`,
  locked: index === 5,
}));

const container = document.getElementById('root');
if (container)
  createRoot(container).render(
    <main style={{ width: 400 }}>
      <section data-fixture="plain">
        <ItemGrid label="Items" lockedLabel="Locked" items={ITEMS} />
      </section>
      <form data-fixture="form">
        <ItemGrid label="Items" lockedLabel="Locked" items={ITEMS} />
      </form>
    </main>,
  );
