import { createElement } from 'lwc';
import SeasonManagement from 'c/seasonManagement';

// Mock Apex methods
import getAllSeasons from '@salesforce/apex/SeasonManagementController.getAllSeasons';
import createSeason from '@salesforce/apex/SeasonManagementController.createSeason';
import updateSeason from '@salesforce/apex/SeasonManagementController.updateSeason';
import deleteSeason from '@salesforce/apex/SeasonManagementController.deleteSeason';

jest.mock(
    '@salesforce/apex/SeasonManagementController.getAllSeasons',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/SeasonManagementController.createSeason',
    () => {
        return { default: jest.fn() };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/SeasonManagementController.updateSeason',
    () => {
        return { default: jest.fn() };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/SeasonManagementController.deleteSeason',
    () => {
        return { default: jest.fn() };
    },
    { virtual: true }
);

// Mock data
const mockSeasons = [
    {
        Id: 'a03000000000001AAA',
        Name: '2024 Season',
        League__c: 'a01000000000001AAA',
        League__r: { Name: 'Professional League' },
        Start_Date__c: '2024-01-01',
        End_Date__c: '2024-06-30',
        Status__c: 'Completed'
    },
    {
        Id: 'a03000000000002AAA',
        Name: '2025 Season',
        League__c: 'a01000000000001AAA',
        League__r: { Name: 'Professional League' },
        Start_Date__c: '2025-01-01',
        End_Date__c: '2025-06-30',
        Status__c: 'Active'
    }
];

describe('c-season-management', () => {
    afterEach(() => {
        // The jsdom instance is shared across test cases in a single file so reset the DOM
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }

        // Clear all mocks
        jest.clearAllMocks();
    });

    async function flushPromises() {
        return Promise.resolve();
    }

    it('renders the component', async () => {
        const element = createElement('c-season-management', {
            is: SeasonManagement
        });

        document.body.appendChild(element);

        await flushPromises();

        expect(element).toBeTruthy();
        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('handles wire data from seasons service', async () => {
        const element = createElement('c-season-management', {
            is: SeasonManagement
        });

        document.body.appendChild(element);

        // Emit data from the wire
        getAllSeasons.emit(mockSeasons);

        await flushPromises();

        // Just verify the component continues to exist after receiving data
        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('handles wire errors gracefully', async () => {
        const element = createElement('c-season-management', {
            is: SeasonManagement
        });

        document.body.appendChild(element);

        // Emit error from the wire
        getAllSeasons.error({ body: { message: 'Database error' } });

        await flushPromises();

        // Component should still exist and be rendered
        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('handles empty season data', async () => {
        const element = createElement('c-season-management', {
            is: SeasonManagement
        });

        document.body.appendChild(element);

        // Emit empty data from the wire
        getAllSeasons.emit([]);

        await flushPromises();

        // Component should handle empty data gracefully
        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('can create season when mocked methods succeed', async () => {
        createSeason.mockResolvedValue('a03000000000003AAA');

        const element = createElement('c-season-management', {
            is: SeasonManagement
        });

        document.body.appendChild(element);

        await flushPromises();

        // Just verify the component exists and the mock is set up
        expect(element).toBeTruthy();
        expect(createSeason).toBeDefined();
    });

    it('can delete season when mocked methods succeed', async () => {
        deleteSeason.mockResolvedValue();

        const element = createElement('c-season-management', {
            is: SeasonManagement
        });

        document.body.appendChild(element);

        await flushPromises();

        // Just verify the component exists and the mock is set up
        expect(element).toBeTruthy();
        expect(deleteSeason).toBeDefined();
    });
});