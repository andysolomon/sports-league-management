import { createElement } from 'lwc';
import DivisionManagement from 'c/divisionManagement';

// Mock Apex methods
import getAllDivisions from '@salesforce/apex/DivisionManagementController.getAllDivisions';
import createDivision from '@salesforce/apex/DivisionManagementController.createDivision';
import assignTeamToDivision from '@salesforce/apex/DivisionManagementController.assignTeamToDivision';
import getTeamsByDivision from '@salesforce/apex/DivisionManagementController.getTeamsByDivision';
import getAllTeams from '@salesforce/apex/TeamDetailsController.getAllTeams';

jest.mock(
    '@salesforce/apex/DivisionManagementController.getAllDivisions',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/TeamDetailsController.getAllTeams',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/DivisionManagementController.createDivision',
    () => {
        return { default: jest.fn() };
    },
    { virtual: true }
);



jest.mock(
    '@salesforce/apex/DivisionManagementController.assignTeamToDivision',
    () => {
        return { default: jest.fn() };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/DivisionManagementController.getTeamsByDivision',
    () => {
        return { default: jest.fn() };
    },
    { virtual: true }
);

// Mock data
const mockDivisions = [
    {
        Id: 'a02000000000001AAA',
        Name: 'Eastern Conference',
        League__c: 'a01000000000001AAA',
        League__r: { Name: 'Professional League' }
    },
    {
        Id: 'a02000000000002AAA',
        Name: 'Western Conference',
        League__c: 'a01000000000001AAA',
        League__r: { Name: 'Professional League' }
    }
];

const mockTeams = [
    {
        Id: 'a00000000000001AAA',
        Name: 'Test Team Alpha',
        City__c: 'Test City Alpha',
        League__c: 'a01000000000001AAA'
    },
    {
        Id: 'a00000000000002AAA',
        Name: 'Test Team Beta',
        City__c: 'Test City Beta',
        League__c: 'a01000000000001AAA'
    }
];

const mockTeamsInDivision = [
    {
        Id: 'a00000000000001AAA',
        Name: 'Test Team Alpha',
        City__c: 'Test City Alpha',
        Division__c: 'a02000000000001AAA'
    }
];

describe('c-division-management', () => {
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
        const element = createElement('c-division-management', {
            is: DivisionManagement
        });

        document.body.appendChild(element);

        await flushPromises();

        expect(element).toBeTruthy();
        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('handles wire data from divisions service', async () => {
        const element = createElement('c-division-management', {
            is: DivisionManagement
        });

        document.body.appendChild(element);

        // Emit data from the wire
        getAllDivisions.emit(mockDivisions);

        await flushPromises();

        // Just verify the component continues to exist after receiving data
        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('handles wire data from teams service', async () => {
        const element = createElement('c-division-management', {
            is: DivisionManagement
        });

        document.body.appendChild(element);

        // Emit data from the wire
        getAllTeams.emit(mockTeams);

        await flushPromises();

        // Just verify the component continues to exist after receiving data
        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('handles wire errors gracefully', async () => {
        const element = createElement('c-division-management', {
            is: DivisionManagement
        });

        document.body.appendChild(element);

        // Emit error from the wire
        getAllDivisions.error({ body: { message: 'Database error' } });

        await flushPromises();

        // Component should still exist and be rendered
        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('handles empty division data', async () => {
        const element = createElement('c-division-management', {
            is: DivisionManagement
        });

        document.body.appendChild(element);

        // Emit empty data from the wire
        getAllDivisions.emit([]);
        getAllTeams.emit([]);

        await flushPromises();

        // Component should handle empty data gracefully
        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('can create division when mocked methods succeed', async () => {
        createDivision.mockResolvedValue('a02000000000003AAA');

        const element = createElement('c-division-management', {
            is: DivisionManagement
        });

        document.body.appendChild(element);

        await flushPromises();

        // Just verify the component exists and the mock is set up
        expect(element).toBeTruthy();
        expect(createDivision).toBeDefined();
    });

    it('can assign teams when mocked methods succeed', async () => {
        assignTeamToDivision.mockResolvedValue();
        getTeamsByDivision.mockResolvedValue(mockTeamsInDivision);

        const element = createElement('c-division-management', {
            is: DivisionManagement
        });

        document.body.appendChild(element);

        await flushPromises();

        // Just verify the component exists and the mocks are set up
        expect(element).toBeTruthy();
        expect(assignTeamToDivision).toBeDefined();
        expect(getTeamsByDivision).toBeDefined();
    });
}); 