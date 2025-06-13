import { jestConfig } from '@salesforce/sfdx-lwc-jest/config.js';

export default {
    ...jestConfig,
    moduleNameMapper: {
        '^@salesforce/apex$': '<rootDir>/sportsmgmt/test/jest-mocks/apex',
        '^@salesforce/schema$': '<rootDir>/sportsmgmt/test/jest-mocks/schema',
        '^lightning/navigation$':
            '<rootDir>/sportsmgmt/test/jest-mocks/lightning/navigation',
        '^lightning/platformShowToastEvent$':
            '<rootDir>/sportsmgmt/test/jest-mocks/lightning/platformShowToastEvent',
        '^lightning/messageService$':
            '<rootDir>/sportsmgmt/test/jest-mocks/lightning/messageService'
    },
    setupFiles: ['jest-canvas-mock'],
    testTimeout: 10000,
    coverageThreshold: {
        global: {
            branches: 75,
            functions: 75,
            lines: 75,
            statements: 75
        }
    }
};
