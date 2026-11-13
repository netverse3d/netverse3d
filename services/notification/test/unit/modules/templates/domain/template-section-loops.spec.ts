import {
  findTemplateProblems,
  MAX_LOOP_DEPTH,
  MAX_LOOP_ITERATIONS,
  renderTemplate,
  TemplateRenderError,
} from '../../../../../src/modules/templates/domain/template-engine';

const text = { escapeHtml: false, maxLength: 10_000 };

function nestedSections(depth: number): string {
  return `${'{{#items}}'.repeat(depth)}x${'{{/items}}'.repeat(depth)}`;
}

describe('khối viết tắt cũng là vòng lặp', () => {
  it('khối viết tắt trên mảng lớn lồng nhau bị dừng theo số vòng', () => {
    const rows = Array.from({ length: 400 }, () => ({ cells: new Array(400).fill('c') }));
    const render = () =>
      renderTemplate('{{#rows}}{{#cells}}{{this}}{{/cells}}{{/rows}}', { rows }, text);
    expect(render).toThrow(TemplateRenderError);
    expect(render).toThrow(`${MAX_LOOP_ITERATIONS} loop iterations`);
  });

  it('khối viết tắt phình kết quả quá cỡ bị từ chối', () => {
    const items = new Array(1_000).fill('i');
    expect(() =>
      renderTemplate(`{{#items}}${'s'.repeat(1_000)}{{/items}}`, { items }, text),
    ).toThrow('longer than 10000 characters');
  });

  it('khối viết tắt lồng quá sâu bị từ chối lúc lưu, lẫn với each cũng vậy', () => {
    const options = { allowRawOutput: true };
    expect(findTemplateProblems(nestedSections(MAX_LOOP_DEPTH), options)).toEqual([]);
    expect(findTemplateProblems(nestedSections(MAX_LOOP_DEPTH + 1), options)).toEqual([
      `loops must not be nested deeper than ${MAX_LOOP_DEPTH}`,
    ]);
    const mixed = `{{#each a}}${nestedSections(MAX_LOOP_DEPTH)}{{/each}}`;
    expect(findTemplateProblems(mixed, options)).toEqual([
      `loops must not be nested deeper than ${MAX_LOOP_DEPTH}`,
    ]);
  });

  it('khối viết tắt trên mảng nhỏ, trên đối tượng và trên giá trị đúng sai vẫn chạy như cũ', () => {
    expect(renderTemplate('{{#items}}{{this}},{{/items}}', { items: ['a', 'b'] }, text)).toBe(
      'a,b,',
    );
    expect(renderTemplate('{{#user}}{{name}}{{/user}}', { user: { name: 'Lan' } }, text)).toBe(
      'Lan',
    );
    expect(renderTemplate('{{#flag}}yes{{/flag}}', { flag: true }, text)).toBe('yes');
    expect(
      renderTemplate(
        '{{#if flag}}{{#if other}}{{#if a}}{{#if b}}ok{{/if}}{{/if}}{{/if}}{{/if}}',
        { flag: 1, other: 1, a: 1, b: 1 },
        text,
      ),
    ).toBe('ok');
  });
});
