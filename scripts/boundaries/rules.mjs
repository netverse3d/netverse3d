const WEB = 'apps/web-3d';
const WEB_ALIASES = { '@/': `${WEB}/src/` };

const NO_REACT = {
  packages: ['react', 'react-dom', 'react-redux', 'next'],
  reason: 'the 3D world and game rules run outside React',
};
const NO_THREE = {
  packages: ['three', '@types/three'],
  reason: 'only the scene layer talks to Three.js',
};

function webLayer(name, forbidden) {
  return { layer: `${WEB}/${name}`, aliases: WEB_ALIASES, forbidden };
}

function noWebLayers(names, reason) {
  return { paths: names.map((name) => `${WEB}/${name}`), reason };
}

export const RULES = [
  webLayer('src/scene', [
    NO_REACT,
    noWebLayers(['src/ui', 'app'], 'the scene reads the state store, never the interface'),
  ]),
  webLayer('src/game', [
    NO_REACT,
    NO_THREE,
    noWebLayers(['src/ui', 'src/scene', 'app'], 'game logic stays testable without a renderer'),
  ]),
  webLayer('src/net', [
    NO_REACT,
    NO_THREE,
    noWebLayers(['src/ui', 'src/scene', 'app'], 'the connection knows nothing about rendering'),
  ]),
  webLayer('src/state', [
    NO_REACT,
    NO_THREE,
    noWebLayers(
      ['src/ui', 'src/scene', 'src/game', 'src/net', 'app'],
      'every layer depends on the state store, so it depends on none of them',
    ),
  ]),
  webLayer('src/ui', [
    NO_THREE,
    noWebLayers(
      ['src/scene', 'src/game', 'src/net'],
      'the interface reaches the game only through the state store',
    ),
  ]),
  webLayer('app', [NO_THREE]),
  {
    layer: 'packages/game-shared',
    forbidden: [
      NO_REACT,
      NO_THREE,
      {
        paths: ['apps', 'services'],
        reason: 'shared rules are used by the client and the server alike',
      },
    ],
  },
  {
    layer: 'packages/game-assets/runtime',
    forbidden: [
      NO_REACT,
      { paths: ['apps', 'services'], reason: 'asset code is shared by every app' },
    ],
  },
];
