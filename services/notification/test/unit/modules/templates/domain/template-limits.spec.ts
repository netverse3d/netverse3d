import { DeliveryReason } from '../../../../../src/modules/notifications/domain/delivery-reasons';
import {
  findTemplateProblems,
  MAX_LOOP_DEPTH,
  MAX_LOOP_ITERATIONS,
  renderTemplate,
  TemplateRenderError,
} from '../../../../../src/modules/templates/domain/template-engine';

const text = { escapeHtml: false, maxLength: 10_000 };

function nestedLoops(depth: number): string {
  return `${'{{#each items}}'.repeat(depth)}x${'{{/each}}'.repeat(depth)}`;
}

function failureOf(render: () => string): TemplateRenderError {
  try {
    render();
  } catch (error) {
    return error as TemplateRenderError;
  }
  throw new Error('the template rendered');
}

describe('giới hạn của template', () => {
  it('nhận vòng lặp lồng tới mức cho phép, từ chối sâu hơn lúc lưu', () => {
    expect(findTemplateProblems(nestedLoops(MAX_LOOP_DEPTH), { allowRawOutput: true })).toEqual([]);
    expect(findTemplateProblems(nestedLoops(MAX_LOOP_DEPTH + 1), { allowRawOutput: true })).toEqual(
      [`loops must not be nested deeper than ${MAX_LOOP_DEPTH}`],
    );
  });

  it('vòng lặp lồng trên mảng lớn bị dừng theo số vòng, không chạy hết', () => {
    const rows = Array.from({ length: 400 }, () => ({ cells: new Array(400).fill('c') }));
    const failure = failureOf(() =>
      renderTemplate('{{#each rows}}{{#each cells}}{{this}}{{/each}}{{/each}}', { rows }, text),
    );
    expect(failure).toBeInstanceOf(TemplateRenderError);
    expect(failure.reason).toBe(DeliveryReason.TEMPLATE_INVALID);
    expect(failure.message).toContain(`${MAX_LOOP_ITERATIONS} loop iterations`);
  });

  it('vòng lặp trong giới hạn vẫn chạy đúng', () => {
    const items = ['a', 'b', 'c'];
    expect(renderTemplate('{{#each items}}{{this}},{{/each}}', { items }, text)).toBe('a,b,c,');
    expect(
      renderTemplate('{{#each map}}{{@key}}={{this}};{{/each}}', { map: { x: 1, y: 2 } }, text),
    ).toBe('x=1;y=2;');
  });

  it('kết quả vượt cỡ cho phép bị từ chối, kể cả khi phình ra trong vòng lặp', () => {
    const long = failureOf(() =>
      renderTemplate(
        '{{value}}',
        { value: 'v'.repeat(200) },
        { escapeHtml: false, maxLength: 100 },
      ),
    );
    expect(long.reason).toBe(DeliveryReason.TEMPLATE_INVALID);
    expect(long.message).toContain('longer than 100 characters');

    const items = new Array(1_000).fill('i');
    const looped = failureOf(() =>
      renderTemplate(
        `{{#each items}}${'s'.repeat(1_000)}{{/each}}`,
        { items },
        { escapeHtml: false, maxLength: 50_000 },
      ),
    );
    expect(looped.message).toContain('longer than 50000 characters');
  });

  it('biến lớn được in nhiều lần ngoài vòng lặp bị dừng theo lượng biến đã đọc', () => {
    const failure = failureOf(() =>
      renderTemplate(
        '{{value}}'.repeat(20),
        { value: 'v'.repeat(64_000) },
        { escapeHtml: false, maxLength: 50_000_000 },
      ),
    );
    expect(failure.reason).toBe(DeliveryReason.TEMPLATE_INVALID);
    expect(failure.message).toContain('characters of variables');
  });

  it('biến lồng trong đối tượng và trong mảng cũng được tính', () => {
    const big = 'v'.repeat(64_000);
    const options = { escapeHtml: false, maxLength: 50_000_000 };
    expect(
      failureOf(() => renderTemplate('{{user.bio}}'.repeat(20), { user: { bio: big } }, options))
        .message,
    ).toContain('characters of variables');
    expect(
      failureOf(() =>
        renderTemplate(
          '{{#each rows}}{{text}}{{/each}}',
          { rows: new Array(20).fill({ text: big }) },
          options,
        ),
      ).message,
    ).toContain('characters of variables');
  });

  it('nhánh else của vòng lặp và khối phủ định không tính là lồng', () => {
    const options = { allowRawOutput: true };
    const chained =
      '{{#each a}}1{{else each b}}2{{else each c}}3{{else each d}}4{{else each e}}5{{/each}}';
    expect(findTemplateProblems(chained, options)).toEqual([]);
    const negated = '{{^a}}{{^b}}{{^c}}{{^d}}x{{/d}}{{/c}}{{/b}}{{/a}}';
    expect(findTemplateProblems(negated, options)).toEqual([]);
  });

  it('thiếu biến vẫn báo đúng lý do sau khi template được dùng lại', () => {
    const source = 'Hello {{name}}';
    expect(renderTemplate(source, { name: 'Lan' }, text)).toBe('Hello Lan');
    expect(failureOf(() => renderTemplate(source, {}, text)).reason).toBe(
      DeliveryReason.MISSING_VARIABLE,
    );
    expect(renderTemplate(source, { name: '<b>' }, { escapeHtml: true, maxLength: 100 })).toBe(
      'Hello &lt;b&gt;',
    );
    expect(renderTemplate(source, { name: '<b>' }, text)).toBe('Hello <b>');
  });
});
