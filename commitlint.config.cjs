module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'feat',
                'fix',
                'docs',
                'style',
                'test',
                'chore',
                'revert',
                'perf',
                'refactor',
                'build',
                'ci'
            ]
        ],
        'subject-case': [0]
    }
};
