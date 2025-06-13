import { createElement } from 'lwc';
import { ShowToastEventName } from 'lightning/platformShowToastEvent';
import TeamDetails from 'c/teamDetails';
import getTeamById from '@salesforce/apex/TeamDetailsController.getTeamById';
import getAllTeams from '@salesforce/apex/TeamDetailsController.getAllTeams';

// Mock Apex methods
jest.mock(
    '@salesforce/apex/TeamDetailsController.getTeamById',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/TeamDetailsController.getAllTeams',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

// Mock data
const mockTeamData = {
    Id: 'a00bm00000nF39RAAS',
    Name: 'Dallas Cowboys',
    City__c: 'Dallas',
    Stadium__c: 'AT&T Stadium',
    Founded_Year__c: 1960,
    League__c: 'a1dbm000004tYbRAAU',
    League__r: {
        Name: 'National Football League'
    }
};

const mockAllTeamsData = [
    mockTeamData,
    {
        Id: 'a00bm00000nF39SAAS',
        Name: 'New England Patriots',
        City__c: 'Foxborough',
        Stadium__c: 'Gillette Stadium',
        Founded_Year__c: 1960,
        League__c: 'a1dbm000004tYbRAAU',
        League__r: {
            Name: 'National Football League'
        }
    }
];

describe('c-team-details', () => {
    afterEach(() => {
        // Clean up DOM after each test
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('Component Initialization', () => {
        it('should create component successfully', () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            document.body.appendChild(element);

            expect(element).toBeTruthy();
        });

        it('should show loading state initially', () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            document.body.appendChild(element);

            const spinner = element.shadowRoot.querySelector('lightning-spinner');
            expect(spinner).toBeTruthy();
        });

        it('should show team selector when no recordId provided', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            document.body.appendChild(element);

            // Mock getAllTeams to return data
            getAllTeams.emit(mockAllTeamsData);

            await Promise.resolve();

            const selector = element.shadowRoot.querySelector('select');
            expect(selector).toBeTruthy();
            
            const options = element.shadowRoot.querySelectorAll('option');
            expect(options.length).toBe(3); // Default option + 2 teams
        });
    });

    describe('Team Data Display with RecordId', () => {
        it('should display team details when recordId is provided', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            element.recordId = mockTeamData.Id;
            document.body.appendChild(element);

            // Mock getTeamById to return data
            getTeamById.emit(mockTeamData);

            await Promise.resolve();

            // Check team name
            const teamNameElement = element.shadowRoot.querySelector('.slds-text-heading_medium');
            expect(teamNameElement).toBeTruthy();
            expect(teamNameElement.textContent).toBe(mockTeamData.Name);

            // Check city
            const cityElements = element.shadowRoot.querySelectorAll('.slds-text-body_regular');
            const cityElement = Array.from(cityElements).find(el => 
                el.textContent === mockTeamData.City__c
            );
            expect(cityElement).toBeTruthy();
        });

        it('should display league information correctly', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            element.recordId = mockTeamData.Id;
            document.body.appendChild(element);

            getTeamById.emit(mockTeamData);

            await Promise.resolve();

            const leagueElements = element.shadowRoot.querySelectorAll('.slds-text-body_regular');
            const leagueElement = Array.from(leagueElements).find(el => 
                el.textContent === mockTeamData.League__r.Name
            );
            expect(leagueElement).toBeTruthy();
        });

        it('should handle missing optional fields gracefully', async () => {
            const incompleteTeamData = {
                Id: 'a00bm00000nF39RAAS',
                Name: 'Test Team',
                League__c: null,
                League__r: null
            };

            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            element.recordId = incompleteTeamData.Id;
            document.body.appendChild(element);

            getTeamById.emit(incompleteTeamData);

            await Promise.resolve();

            const notSpecifiedElements = element.shadowRoot.querySelectorAll('.slds-text-color_weak');
            expect(notSpecifiedElements.length).toBeGreaterThan(0);
        });
    });

    describe('Team Selection Functionality', () => {
        it('should handle team selection from dropdown', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            document.body.appendChild(element);

            // Mock getAllTeams to return data
            getAllTeams.emit(mockAllTeamsData);

            await Promise.resolve();

            const selector = element.shadowRoot.querySelector('select');
            selector.value = mockTeamData.Id;
            selector.dispatchEvent(new CustomEvent('change'));

            await Promise.resolve();

            // After selection, the component should show loading state
            const spinner = element.shadowRoot.querySelector('lightning-spinner');
            expect(spinner).toBeTruthy();
        });

        it('should clear team details when empty selection is made', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            document.body.appendChild(element);

            getAllTeams.emit(mockAllTeamsData);

            await Promise.resolve();

            const selector = element.shadowRoot.querySelector('select');
            selector.value = '';
            selector.dispatchEvent(new CustomEvent('change'));

            await Promise.resolve();

            // Should not show team details section
            const teamDetailsSection = element.shadowRoot.querySelector('[data-id="team-details-content"]');
            expect(teamDetailsSection).toBeFalsy();
        });
    });

    describe('Error Handling', () => {
        it('should display error when getTeamById fails', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            element.recordId = mockTeamData.Id;
            document.body.appendChild(element);

            // Mock error response
            getTeamById.error({ message: 'Test error' });

            await Promise.resolve();

            const errorElement = element.shadowRoot.querySelector('.slds-theme_error');
            expect(errorElement).toBeTruthy();
        });

        it('should display error when getAllTeams fails', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            document.body.appendChild(element);

            // Mock error response
            getAllTeams.error({ message: 'Test error' });

            await Promise.resolve();

            const errorElement = element.shadowRoot.querySelector('.slds-theme_error');
            expect(errorElement).toBeTruthy();
        });

        it('should show toast message on error', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            element.recordId = mockTeamData.Id;
            document.body.appendChild(element);

            // Mock toast event handler
            const handler = jest.fn();
            element.addEventListener(ShowToastEventName, handler);

            getTeamById.error({ message: 'Test error' });

            await Promise.resolve();

            expect(handler).toHaveBeenCalled();
            expect(handler.mock.calls[0][0].detail.variant).toBe('error');
        });
    });

    describe('Refresh Functionality', () => {
        it('should refresh team data when refresh button is clicked', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            element.recordId = mockTeamData.Id;
            document.body.appendChild(element);

            getTeamById.emit(mockTeamData);

            await Promise.resolve();

            const refreshButton = element.shadowRoot.querySelector('lightning-button-icon');
            refreshButton.click();

            await Promise.resolve();

            // Should show loading state after refresh
            const spinner = element.shadowRoot.querySelector('lightning-spinner');
            expect(spinner).toBeTruthy();
        });

        it('should refresh teams list when no recordId and refresh is clicked', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            document.body.appendChild(element);

            getAllTeams.emit(mockAllTeamsData);

            await Promise.resolve();

            const refreshButton = element.shadowRoot.querySelector('lightning-button-icon');
            refreshButton.click();

            await Promise.resolve();

            // Should show loading state after refresh
            const spinner = element.shadowRoot.querySelector('lightning-spinner');
            expect(spinner).toBeTruthy();
        });
    });

    describe('Responsive Behavior', () => {
        it('should have proper SLDS grid classes for responsive layout', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            element.recordId = mockTeamData.Id;
            document.body.appendChild(element);

            getTeamById.emit(mockTeamData);

            await Promise.resolve();

            const gridContainer = element.shadowRoot.querySelector('.slds-grid');
            expect(gridContainer).toBeTruthy();
            expect(gridContainer.classList.contains('slds-wrap')).toBe(true);
            expect(gridContainer.classList.contains('slds-gutters')).toBe(true);
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels and roles', async () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            document.body.appendChild(element);

            getAllTeams.emit(mockAllTeamsData);

            await Promise.resolve();

            const selector = element.shadowRoot.querySelector('select');
            const label = element.shadowRoot.querySelector('label');
            
            expect(selector).toBeTruthy();
            expect(label).toBeTruthy();
            expect(label.textContent).toBe('Select a Team');
        });

        it('should have proper spinner alternative text', () => {
            const element = createElement('c-team-details', {
                is: TeamDetails
            });
            document.body.appendChild(element);

            const spinner = element.shadowRoot.querySelector('lightning-spinner');
            expect(spinner.alternativeText).toBe('Loading team details...');
        });
    });
});