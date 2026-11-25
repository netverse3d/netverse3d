import { useState } from 'react';
import { contrastRatio } from '../src/contrast.mjs';
import { CONTRAST_RULES, librarySections } from './sections.mjs';
import type libraryText from './text.json';

type LibraryText = typeof libraryText;
type Section = { id: string; kind: string; tokens: string[] };

export function tokenValue(token: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

function Value({ token }: { token: string }) {
  return <span className="value">{tokenValue(token)}</span>;
}

function Swatch({ token }: { token: string }) {
  return (
    <figure className="swatch">
      <span className="chip" style={{ background: `var(${token})` }} />
      <figcaption>
        <code>{token}</code>
        <Value token={token} />
      </figcaption>
    </figure>
  );
}

function ValueRow({ token }: { token: string }) {
  return (
    <p className="value-row">
      <code>{token}</code>
      <Value token={token} />
    </p>
  );
}

function ContrastTable({ text }: { text: LibraryText }) {
  const rows = CONTRAST_RULES.flatMap((rule) =>
    rule.foregrounds.flatMap((foreground: string) =>
      rule.backgrounds.map((background: string) => ({ ...rule, foreground, background })),
    ),
  );
  return (
    <table className="contrast">
      <thead>
        <tr>
          <th>{text.contrast.pair}</th>
          <th>{text.contrast.ratio}</th>
          <th>{text.contrast.minimum}</th>
          <th>{text.contrast.criterion}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map(({ foreground, background, minimum, criterion }) => {
          const ratio = contrastRatio(tokenValue(foreground), tokenValue(background));
          const passed = ratio >= minimum;
          return (
            <tr key={`${foreground}/${background}`}>
              <td>
                <span
                  className="pair"
                  style={{ color: `var(${foreground})`, background: `var(${background})` }}
                >
                  Aa
                </span>
                <code>{`${foreground} / ${background}`}</code>
              </td>
              <td className="ratio">{Number.isFinite(ratio) ? `${ratio.toFixed(2)}:1` : ''}</td>
              <td>{`${minimum}:1`}</td>
              <td>{criterion}</td>
              <td className="verdict" data-passed={String(passed)}>
                {passed ? text.contrast.pass : text.contrast.fail}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MotionRow({ token, label }: { token: string; label: string }) {
  const [moved, setMoved] = useState(false);
  return (
    <p className="motion-row">
      <button type="button" onClick={() => setMoved(!moved)}>
        {label}
      </button>
      <span className="track">
        <span
          className={moved ? 'dot moved' : 'dot'}
          style={{ transitionDuration: `var(${token})` }}
        />
      </span>
      <code>{token}</code>
      <Value token={token} />
    </p>
  );
}

function SectionBody({ section, text }: { section: Section; text: LibraryText }) {
  const { kind, tokens } = section;
  if (kind === 'swatches')
    return (
      <div className="swatches">
        {tokens.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </div>
    );
  if (kind === 'contrast') return <ContrastTable text={text} />;
  if (kind === 'typography')
    return (
      <>
        {tokens
          .filter((token) => token.startsWith('--ui-text-'))
          .map((token) => (
            <p key={token} className="type-sample" style={{ fontSize: `var(${token})` }}>
              <code>{token}</code> {text.sample}
            </p>
          ))}
        {tokens
          .filter((token) => !token.startsWith('--ui-text-'))
          .map((token) => (
            <ValueRow key={token} token={token} />
          ))}
      </>
    );
  if (kind === 'spacing')
    return (
      <>
        {tokens.map((token) => (
          <p key={token} className="bar-row">
            <span className="bar" style={{ width: `var(${token})` }} />
            <code>{token}</code>
            <Value token={token} />
          </p>
        ))}
      </>
    );
  if (kind === 'radius')
    return (
      <div className="swatches">
        {tokens.map((token) => (
          <figure key={token} className="radius-sample">
            <span className="corner" style={{ borderRadius: `var(${token})` }} />
            <figcaption>
              <code>{token}</code>
            </figcaption>
          </figure>
        ))}
      </div>
    );
  if (kind === 'layers')
    return (
      <div className="layer-stack">
        {tokens.map((token, index) => (
          <div
            key={token}
            className="layer"
            style={{
              zIndex: `var(${token})`,
              insetInlineStart: `calc(var(--ui-space-6) * ${index})`,
              insetBlockStart: `calc(var(--ui-space-8) * ${index} + var(--ui-space-2) * ${index})`,
            }}
          >
            <code>{token}</code>
            <Value token={token} />
          </div>
        ))}
      </div>
    );
  if (kind === 'motion')
    return (
      <>
        {tokens.map((token) => (
          <MotionRow key={token} token={token} label={text.motionPlay} />
        ))}
      </>
    );
  return (
    <>
      {tokens.map((token) => (
        <ValueRow key={token} token={token} />
      ))}
    </>
  );
}

export function Foundations({ text }: { text: LibraryText }) {
  return (
    <>
      {(librarySections() as Section[]).map((section) => (
        <section key={section.id} id={section.id} className="panel">
          <h2>{text.sections[section.id as keyof LibraryText['sections']]}</h2>
          <SectionBody section={section} text={text} />
        </section>
      ))}
    </>
  );
}
