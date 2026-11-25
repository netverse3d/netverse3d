import { useEffect, useRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { IconButton } from './actions.tsx';
import { Icon } from './icon.tsx';
import { closesOnCancel } from '../src/interaction.mjs';
import { classNames, splitVariants } from './shared.ts';
import { Status } from './feedback.tsx';
import {
  VARIANTS,
  type DialogVariants,
  type ListItemVariants,
  type PanelVariants,
  type ShopCardVariants,
  type TileVariants,
} from './variants.generated.ts';

type NativeBlock = Omit<HTMLAttributes<HTMLElement>, 'style' | 'title'>;

export type PanelProps = PanelVariants &
  NativeBlock & {
    as?: 'section' | 'div' | 'article' | 'aside' | 'header' | 'footer';
    title?: ReactNode;
    titleId?: string;
    titleLevel?: 1 | 2 | 3;
    meta?: ReactNode;
    action?: ReactNode;
    chevrons?: boolean;
  };

export function Panel(props: PanelProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Panel, { duo: 'cyan' });
  const {
    as: Tag = 'section',
    title,
    titleId,
    titleLevel = 2,
    meta,
    action,
    chevrons = true,
    className,
    children,
    ...native
  } = rest as PanelProps;
  const hasHead = title !== undefined || meta !== undefined || action !== undefined;
  const TitleTag = `h${titleLevel}` as 'h1' | 'h2' | 'h3';
  return (
    <Tag {...native} className={classNames('nv-shape nv-panel', className)} {...data}>
      {hasHead && (
        <header className="nv-panel__head">
          {title !== undefined && (
            <TitleTag
              id={titleId}
              className={classNames('nv-panel__title', chevrons && 'nv-chevrons')}
            >
              {title}
            </TitleTag>
          )}
          {meta !== undefined && <span className="nv-panel__meta">{meta}</span>}
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}

export type DialogProps = DialogVariants &
  Omit<HTMLAttributes<HTMLDialogElement>, 'style' | 'title' | 'onClose' | 'children'> & {
    open: boolean;
    title: ReactNode;
    titleId: string;
    titleLevel?: 1 | 2 | 3;
    closeLabel: string;
    onClose: () => void;
    busy?: boolean;
    children: ReactNode;
  };

export function Dialog({
  open,
  title,
  titleId,
  titleLevel,
  closeLabel,
  onClose,
  busy = false,
  size,
  className,
  children,
  ...native
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      {...native}
      ref={ref}
      className={classNames('nv-modal', className)}
      data-size={size === 'lg' ? 'lg' : undefined}
      aria-labelledby={titleId}
      onKeyDown={(event: KeyboardEvent) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        if (closesOnCancel(busy)) onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      {open && (
        <Panel
          as="div"
          className="nv-dialog"
          shape="bevel-all"
          cut="lg"
          tone="primary"
          duo="magenta"
          surface="solid"
          title={title}
          titleId={titleId}
          titleLevel={titleLevel}
          action={
            <IconButton
              icon="close"
              label={closeLabel}
              tone="neutral"
              surface="glass"
              disabled={busy}
              onClick={onClose}
            />
          }
        >
          {children}
        </Panel>
      )}
    </dialog>
  );
}

export type ShopCardProps = ShopCardVariants &
  NativeBlock & {
    name: ReactNode;
    about?: ReactNode;
    imageSrc?: string;
    rows?: Array<{ icon: 'monitor' | 'seats' | 'friends'; label: ReactNode }>;
    status?: ReactNode;
    action?: ReactNode;
  };

export function ShopCard(props: ShopCardProps) {
  const { data, rest } = splitVariants(props, VARIANTS.ShopCard, {
    shape: 'bevel-all',
    cut: 'lg',
    duo: 'cyan',
  });
  const {
    name,
    about,
    imageSrc,
    rows = [],
    status,
    action,
    className,
    ...native
  } = rest as ShopCardProps;
  return (
    <article {...native} className={classNames('nv-shape nv-card', className)} {...data}>
      <div className="nv-shape nv-card__media" data-tone="cyan" data-surface="solid">
        {imageSrc && <img src={imageSrc} alt="" loading="lazy" />}
      </div>
      <div className="nv-card__body">
        <h3 className="nv-card__title">{name}</h3>
        {about && <p className="nv-card__about">{about}</p>}
        {rows.map((row, index) => (
          <span key={index} className="nv-card__row">
            <Icon name={row.icon} />
            {row.label}
          </span>
        ))}
        {(status || action) && (
          <div className="nv-card__foot">
            {status && <Status>{status}</Status>}
            {action}
          </div>
        )}
      </div>
    </article>
  );
}

export type TileProps = TileVariants & NativeBlock;

export function Tile({ className, children, ...native }: TileProps) {
  return (
    <div {...native} className={classNames('nv-shape nv-tile', className)}>
      {children}
    </div>
  );
}

export type ListItemProps = ListItemVariants & Omit<HTMLAttributes<HTMLLIElement>, 'style'>;

export function ListItem(props: ListItemProps) {
  const { data, rest } = splitVariants(props, VARIANTS.ListItem);
  const { className, children, ...native } = rest as ListItemProps;
  return (
    <li {...native} className={classNames('nv-shape nv-list-item', className)} {...data}>
      {children}
    </li>
  );
}
