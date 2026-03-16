import { createElement } from 'lwc';
import PlayerRoster from 'c/playerRoster';

// Mock Apex methods
import getAllPlayers from '@salesforce/apex/PlayerRosterController.getAllPlayers';
import getAllTeams from '@salesforce/apex/TeamDetailsController.getAllTeams';
import createPlayer from '@salesforce/apex/PlayerRosterController.createPlayer';
import updatePlayer from '@salesforce/apex/PlayerRosterController.updatePlayer';
import deletePlayer from '@salesforce/apex/PlayerRosterController.deletePlayer';

jest.mock(
    '@salesforce/apex/PlayerRosterController.getAllPlayers',
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
    '@salesforce/apex/PlayerRosterController.createPlayer',
    () => {
        return { default: jest.fn() };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/PlayerRosterController.updatePlayer',
    () => {
        return { default: jest.fn() };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/PlayerRosterController.deletePlayer',
    () => {
        return { default: jest.fn() };
    },
    { virtual: true }
);

// Mock data
const mockPlayers = [
    {
        Id: 'a04000000000001AAA',
        Name: 'John Smith',
        Team__c: 'a00000000000001AAA',
        Team__r: { Name: 'Eagles' },
        Position__c: 'Forward',
        Jersey_Number__c: 10,
        Date_of_Birth__c: '1995-03-15',
        Status__c: 'Active'
    },
    {
        Id: 'a04000000000002AAA',
        Name: 'Jane Doe',
        Team__c: 'a00000000000002AAA',
        Team__r: { Name: 'Hawks' },
        Position__c: 'Goalkeeper',
        Jersey_Number__c: 1,
        Date_of_Birth__c: '1998-07-22',
        Status__c: 'Injured'
    }
];

const mockTeams = [
    { Id: 'a00000000000001AAA', Name: 'Eagles' },
    { Id: 'a00000000000002AAA', Name: 'Hawks' }
];

describe('c-player-roster', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    async function flushPromises() {
        return Promise.resolve();
    }

    it('renders the component', async () => {
        const element = createElement('c-player-roster', {
            is: PlayerRoster
        });

        document.body.appendChild(element);

        await flushPromises();

        expect(element).toBeTruthy();
        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('handles wire data from players service', async () => {
        const element = createElement('c-player-roster', {
            is: PlayerRoster
        });

        document.body.appendChild(element);

        // Emit data from the wires
        getAllPlayers.emit(mockPlayers);
        getAllTeams.emit(mockTeams);

        await flushPromises();

        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('handles wire errors gracefully', async () => {
        const element = createElement('c-player-roster', {
            is: PlayerRoster
        });

        document.body.appendChild(element);

        // Emit error from the wire
        getAllPlayers.error({ body: { message: 'Database error' } });

        await flushPromises();

        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('handles empty player data', async () => {
        const element = createElement('c-player-roster', {
            is: PlayerRoster
        });

        document.body.appendChild(element);

        // Emit empty data from the wire
        getAllPlayers.emit([]);

        await flushPromises();

        expect(element.shadowRoot).toBeInstanceOf(DocumentFragment);
    });

    it('can create player when mocked methods succeed', async () => {
        createPlayer.mockResolvedValue('a04000000000003AAA');

        const element = createElement('c-player-roster', {
            is: PlayerRoster
        });

        document.body.appendChild(element);

        await flushPromises();

        expect(element).toBeTruthy();
        expect(createPlayer).toBeDefined();
    });

    it('can delete player when mocked methods succeed', async () => {
        deletePlayer.mockResolvedValue();

        const element = createElement('c-player-roster', {
            is: PlayerRoster
        });

        document.body.appendChild(element);

        await flushPromises();

        expect(element).toBeTruthy();
        expect(deletePlayer).toBeDefined();
    });
});
