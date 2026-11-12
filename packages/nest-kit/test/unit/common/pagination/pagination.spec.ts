import { AppException } from '../../../../src/common/errors/app.exception';
import { PageResponseDto } from '../../../../src/common/pagination/page-response.dto';
import { PaginationQueryDto } from '../../../../src/common/pagination/pagination-query.dto';
import { resolveSort } from '../../../../src/common/pagination/resolve-sort';

function query(page: number, size: number): PaginationQueryDto {
  return Object.assign(new PaginationQueryDto(), { page, size });
}

describe('phân trang', () => {
  it('đổi trang đánh số từ 1 thành skip và take', () => {
    expect(query(3, 20).skip).toBe(40);
    expect(query(3, 20).take).toBe(20);
  });

  it('làm tròn lên tổng số trang', () => {
    expect(PageResponseDto.of([], query(1, 20), 41).totalPages).toBe(3);
  });

  it('trả 0 trang khi không có phần tử', () => {
    expect(PageResponseDto.of([], query(1, 20), 0).totalPages).toBe(0);
  });
});

describe('sắp xếp', () => {
  it('dùng giá trị mặc định khi không truyền', () => {
    expect(resolveSort(undefined, ['createdAt'], { createdAt: 'desc' })).toEqual({
      createdAt: 'desc',
    });
  });

  it('nhận trường nằm trong danh sách cho phép', () => {
    expect(resolveSort('name,asc', ['name'], {})).toEqual({ name: 'asc' });
  });

  it('từ chối trường ngoài danh sách cho phép', () => {
    expect(() => resolveSort('passwordHash,asc', ['name'], {})).toThrow(AppException);
  });
});
