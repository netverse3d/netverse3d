import {
  findTemplateProblems,
  renderTemplate,
  TemplateRenderError,
} from '../../../../../src/modules/templates/domain/template-engine';

describe('kiểm tra template khi lưu', () => {
  const email = { allowRawOutput: false };
  const text = { allowRawOutput: true };

  it('nhận template hợp lệ có if, each, lookup', () => {
    const source = '{{#if a}}{{b}}{{else}}{{c}}{{/if}}{{#each d}}{{this}}{{/each}}{{lookup e "f"}}';
    expect(findTemplateProblems(source, email)).toEqual([]);
  });

  it('từ chối template sai cú pháp', () => {
    expect(findTemplateProblems('Hello {{#if name}}', email).length).toBeGreaterThan(0);
    expect(findTemplateProblems('{{a', email).length).toBeGreaterThan(0);
  });

  it('từ chối helper không có sẵn', () => {
    expect(findTemplateProblems('{{upper name}}', email)).toEqual(['unknown helper "upper"']);
    expect(findTemplateProblems('{{#if (trim name)}}x{{/if}}', email)).toEqual([
      'unknown helper "trim"',
    ]);
  });

  it('từ chối partial', () => {
    expect(findTemplateProblems('{{> header}}', email)).toEqual(['partials are not supported']);
  });

  it('từ chối xuất thô trong thân email nhưng cho phép ở kênh văn bản', () => {
    expect(findTemplateProblems('{{{raw}}}', email)).toEqual([
      'unescaped output is not allowed in an email body',
    ]);
    expect(findTemplateProblems('{{&raw}}', email).length).toBeGreaterThan(0);
    expect(findTemplateProblems('{{{raw}}}', text)).toEqual([]);
  });
});

describe('render template', () => {
  it('thoát HTML khi bật thoát', () => {
    expect(renderTemplate('<p>{{name}}</p>', { name: '<b>x</b>' }, { escapeHtml: true })).toBe(
      '<p>&lt;b&gt;x&lt;/b&gt;</p>',
    );
  });

  it('giữ nguyên chuỗi khi không thoát', () => {
    expect(renderTemplate('{{name}}', { name: 'A&B' }, { escapeHtml: false })).toBe('A&B');
  });

  it('báo thiếu biến thay vì để trống', () => {
    expect(() => renderTemplate('Hi {{name}}', {}, { escapeHtml: true })).toThrow(
      TemplateRenderError,
    );
    try {
      renderTemplate('Hi {{user.name}}', { user: {} }, { escapeHtml: true });
      throw new Error('should have failed');
    } catch (error) {
      expect(error).toBeInstanceOf(TemplateRenderError);
      expect((error as TemplateRenderError).reason).toBe('MISSING_VARIABLE');
      expect((error as TemplateRenderError).message).toContain('name');
    }
  });

  it('coi giá trị null như thiếu biến', () => {
    expect(() => renderTemplate('Hi {{name}}', { name: null }, { escapeHtml: true })).toThrow(
      'name',
    );
  });

  it('không báo thiếu với biến chỉ dùng trong if', () => {
    expect(renderTemplate('{{#if opt}}yes{{else}}no{{/if}}', {}, { escapeHtml: true })).toBe('no');
  });

  it('dùng được biến thương hiệu lồng', () => {
    expect(
      renderTemplate('{{brand.name}}', { brand: { name: 'Acme' } }, { escapeHtml: true }),
    ).toBe('Acme');
  });

  it('không cho đọc thuộc tính nguyên mẫu', () => {
    expect(() => renderTemplate('{{constructor.name}}', {}, { escapeHtml: true })).toThrow(
      TemplateRenderError,
    );
  });
});
