import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    lang: 'vi-VN',
    title: 'Netverse 3D',
    description: 'Wiki dự án Netverse 3D',
    base: '/netverse3d/',
    ignoreDeadLinks: false,
    lastUpdated: true,
    themeConfig: {
      search: { provider: 'local' },
      socialLinks: [{ icon: 'github', link: 'https://github.com/netverse3d/netverse3d' }],
      nav: [
        { text: 'Bắt đầu', link: '/wiki/team/onboarding' },
        { text: 'Nghiệp vụ', link: '/wiki/product/overview' },
        { text: 'Kỹ thuật', link: '/wiki/engineering/architecture' },
        { text: 'Yêu cầu', link: '/requirements/' },
        { text: 'Quyết định', link: '/decisions/' },
      ],
      sidebar: [
        {
          text: 'Nhóm',
          items: [
            { text: 'Ngày đầu tiên', link: '/wiki/team/onboarding' },
            { text: 'Luồng làm việc', link: '/wiki/team/workflow' },
            { text: 'Thành viên', link: '/wiki/team/members' },
            { text: 'Lộ trình', link: '/wiki/team/roadmap' },
          ],
        },
        {
          text: 'Nghiệp vụ',
          items: [
            { text: 'Tổng quan sản phẩm', link: '/wiki/product/overview' },
            { text: 'Luồng nghiệp vụ', link: '/wiki/product/business-flows' },
            { text: 'Thuật ngữ', link: '/wiki/product/glossary' },
            { text: 'Câu hỏi mở', link: '/wiki/open-questions' },
          ],
        },
        {
          text: 'Kỹ thuật',
          items: [
            { text: 'Kiến trúc', link: '/wiki/engineering/architecture' },
            { text: 'Danh sách thành phần', link: '/wiki/engineering/components' },
            { text: 'Chuẩn thành phần', link: '/wiki/engineering/component-standard' },
            { text: 'Quy ước', link: '/wiki/engineering/conventions' },
            { text: 'Nhánh và phát hành', link: '/wiki/engineering/branching-and-release' },
          ],
        },
        {
          text: 'Sổ theo dõi',
          items: [
            { text: 'Sổ yêu cầu', link: '/requirements/' },
            { text: 'Sổ quyết định', link: '/decisions/' },
            { text: 'Nguồn của yêu cầu', link: '/sources/README' },
          ],
        },
        {
          text: 'Quy trình vận hành',
          items: [
            { text: 'Nhận service có sẵn', link: '/runbooks/import-service' },
            { text: 'Phát hành', link: '/runbooks/release' },
          ],
        },
      ],
    },
  }),
);
