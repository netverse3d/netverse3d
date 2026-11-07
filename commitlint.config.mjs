export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'body-empty': [2, 'always'],
    'subject-case': [2, 'always', 'lower-case'],
  },
};
