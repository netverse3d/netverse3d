'use client';

import { useState } from 'react';
import { Provider } from 'react-redux';
import { createAppStore } from '../src/state/store.ts';
import PwaActions from '../src/ui/pwa-actions.tsx';
import AccountEntry from './account-entry.tsx';
import ShopView from './shop-view.tsx';

export default function GameRoot() {
  const [app] = useState(createAppStore);
  return (
    <Provider store={app.store}>
      <ShopView app={app} />
      <AccountEntry />
      <PwaActions />
    </Provider>
  );
}
