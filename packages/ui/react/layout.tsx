import * as AccordionPrimitive from '@radix-ui/react-accordion';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { IconButton } from './actions.tsx';
import { Icon } from './icon.tsx';
import { useLayerContainer } from './layer.ts';
import { TextLink } from './navigation.tsx';
import { classNames, splitVariants } from './shared.ts';
import { VARIANTS, type DrawerVariants, type TableVariants } from './variants.generated.ts';

export type DrawerProps = DrawerVariants & {
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
  trigger?: ReactElement;
  description?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

export function Drawer(props: DrawerProps) {
  const { data, rest } = splitVariants(props, VARIANTS.Drawer, { side: 'right', size: 'md' });
  const { title, closeLabel, children, trigger, description, className, ...openState } =
    rest as DrawerProps;
  const [findContainer, container] = useLayerContainer();
  return (
    <DialogPrimitive.Root {...openState}>
      <span ref={findContainer} hidden />
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Overlay className="nv-drawer__scrim" />
        <DialogPrimitive.Content
          className={classNames('nv-shape nv-drawer', className)}
          data-shape="bevel"
          data-surface="solid"
          data-tone="cyan"
          data-duo="magenta"
          {...data}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <header className="nv-drawer__header">
            <DialogPrimitive.Title className="nv-drawer__title">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton icon="close" label={closeLabel} tone="neutral" surface="glass" />
            </DialogPrimitive.Close>
          </header>
          {description && (
            <DialogPrimitive.Description className="nv-drawer__description">
              {description}
            </DialogPrimitive.Description>
          )}
          <div className="nv-drawer__body">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export type AccordionItem = { value: string; title: ReactNode; content: ReactNode };

export type AccordionProps = {
  items: readonly AccordionItem[];
  multiple?: boolean;
  defaultValue?: readonly string[];
  className?: string;
};

export function Accordion({
  items,
  multiple = false,
  defaultValue = [],
  className,
}: AccordionProps) {
  const sections = items.map((item) => (
    <AccordionPrimitive.Item key={item.value} value={item.value} className="nv-accordion__item">
      <AccordionPrimitive.Header className="nv-accordion__header">
        <AccordionPrimitive.Trigger className="nv-accordion__trigger">
          <span>{item.title}</span>
          <span className="nv-accordion__icon" aria-hidden="true">
            <Icon name="chevronDown" />
          </span>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="nv-accordion__content">
        <div className="nv-accordion__body">{item.content}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  ));
  const classes = classNames('nv-accordion', className);
  return multiple ? (
    <AccordionPrimitive.Root type="multiple" defaultValue={[...defaultValue]} className={classes}>
      {sections}
    </AccordionPrimitive.Root>
  ) : (
    <AccordionPrimitive.Root
      type="single"
      collapsible
      defaultValue={defaultValue[0]}
      className={classes}
    >
      {sections}
    </AccordionPrimitive.Root>
  );
}

export type TableColumn<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: 'start' | 'end';
};

export type TableProps<Row> = TableVariants &
  Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'children'> & {
    caption: ReactNode;
    columns: readonly TableColumn<Row>[];
    rows: readonly Row[];
    rowKey: (row: Row) => string;
    empty: ReactNode;
  };

export function Table<Row>(props: TableProps<Row>) {
  const { data, rest } = splitVariants(props, VARIANTS.Table, { density: 'comfortable' });
  const { caption, columns, rows, rowKey, empty, className, ...native } = rest as TableProps<Row>;
  return (
    <div
      {...native}
      className={classNames('nv-shape nv-table', className)}
      data-shape="bevel-all"
      data-cut="sm"
      {...data}
    >
      <table className="nv-table__grid">
        <caption className="nv-table__caption">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" data-align={column.align}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="nv-table__empty" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} data-align={column.align}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export type BreadcrumbItem = { label: ReactNode; href?: string };

export type BreadcrumbProps = {
  label: string;
  items: readonly BreadcrumbItem[];
  className?: string;
};

export function Breadcrumb({ label, items, className }: BreadcrumbProps) {
  return (
    <nav className={classNames('nv-breadcrumb', className)} aria-label={label}>
      <ol className="nv-breadcrumb__list">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={index} className="nv-breadcrumb__item">
              {last ? (
                <span className="nv-breadcrumb__current" aria-current="page">
                  {item.label}
                </span>
              ) : item.href ? (
                <TextLink href={item.href}>{item.label}</TextLink>
              ) : (
                <span className="nv-breadcrumb__text">{item.label}</span>
              )}
              {!last && (
                <span className="nv-breadcrumb__separator" aria-hidden="true">
                  <Icon name="chevron" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
