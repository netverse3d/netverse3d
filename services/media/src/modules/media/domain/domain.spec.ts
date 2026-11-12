import { AppException } from '../../../common/errors/app.exception';
import { MediaErrorCode } from '../media-error-codes';
import { objectFileName } from './object-file-name';
import { assertContentTypeAllowed, assertSizeAllowed } from './upload-policy';

describe('tên object', () => {
  it('giữ phần mở rộng đúng với định dạng', () => {
    expect(objectFileName('photo.png', 'image/png')).toBe('photo.png');
  });

  it('coi jpeg và jpg là một', () => {
    expect(objectFileName('photo.jpeg', 'image/jpeg')).toBe('photo.jpeg');
  });

  it('đổi phần mở rộng sai theo định dạng thật', () => {
    expect(objectFileName('photo.png', 'image/webp')).toBe('photo.webp');
  });

  it('thêm phần mở rộng cho mô hình GLB', () => {
    expect(objectFileName('chair', 'model/gltf-binary')).toBe('chair.glb');
  });

  it('loại ký tự nguy hiểm khỏi đường dẫn', () => {
    expect(objectFileName('../../etc/passwd', 'application/pdf')).toBe('.._.._etc_passwd.pdf');
  });

  it('đặt tên mặc định khi không có tên gốc', () => {
    expect(objectFileName(undefined, 'audio/mpeg')).toBe('file.mp3');
  });
});

describe('chính sách tải lên', () => {
  const policy = { allowedTypes: ['image/png', 'audio/*'], maxBytes: 100 };

  function codeOf(action: () => void): string {
    try {
      action();
    } catch (error) {
      return (error as AppException).definition.code;
    }
    return 'NO_ERROR';
  }

  it('nhận định dạng khớp chính xác và bỏ qua tham số', () => {
    expect(codeOf(() => assertContentTypeAllowed('IMAGE/PNG; charset=binary', policy))).toBe(
      'NO_ERROR',
    );
  });

  it('nhận định dạng khớp ký tự đại diện', () => {
    expect(codeOf(() => assertContentTypeAllowed('audio/ogg', policy))).toBe('NO_ERROR');
  });

  it('từ chối định dạng ngoài danh sách', () => {
    expect(codeOf(() => assertContentTypeAllowed('model/gltf-binary', policy))).toBe(
      MediaErrorCode.TYPE_NOT_ALLOWED.code,
    );
  });

  it('không để audio khớp nhầm tiền tố khác', () => {
    expect(codeOf(() => assertContentTypeAllowed('audiox/ogg', policy))).toBe(
      MediaErrorCode.TYPE_NOT_ALLOWED.code,
    );
  });

  it('nhận đúng mức dung lượng tối đa, từ chối khi vượt', () => {
    expect(codeOf(() => assertSizeAllowed(100, policy))).toBe('NO_ERROR');
    expect(codeOf(() => assertSizeAllowed(101, policy))).toBe(MediaErrorCode.SIZE_EXCEEDED.code);
  });
});
