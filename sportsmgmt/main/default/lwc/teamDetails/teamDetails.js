import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAllTeams from '@salesforce/apex/TeamDetailsController.getAllTeams';
import getTeamById from '@salesforce/apex/TeamDetailsController.getTeamById';

export default class TeamDetails extends LightningElement {
    @api recordId; // Team record ID
    @track error;
    @track isLoading = true;
    @track teams = [];
    @track selectedTeamId;
    @track team;

    // Wire all teams when no recordId is provided
    @wire(getAllTeams)
    wiredTeams({ error, data }) {
        if (!this.recordId) {
            if (data) {
                this.teams = data;
                this.isLoading = false;
            } else if (error) {
                this.error = error;
                this.isLoading = false;
                this.showErrorToast('Error loading teams');
            }
        }
    }

    // Wire specific team when recordId is provided
    @wire(getTeamById, { teamId: '$recordId' })
    wiredTeam({ error, data }) {
        if (this.recordId) {
            if (data) {
                this.team = data;
                this.error = undefined;
                this.isLoading = false;
            } else if (error) {
                this.error = error;
                this.team = undefined;
                this.isLoading = false;
                this.showErrorToast('Error loading team details');
            }
        }
    }

    // Load available teams when no recordId is provided
    connectedCallback() {
        if (this.recordId) {
            this.isLoading = true;
        }
    }

    handleTeamSelection(event) {
        this.selectedTeamId = event.target.value;
        if (this.selectedTeamId) {
            this.isLoading = true;
            this.loadSelectedTeam();
        }
    }

    async loadSelectedTeam() {
        try {
            this.team = await getTeamById({ teamId: this.selectedTeamId });
            this.error = undefined;
            this.isLoading = false;
        } catch (error) {
            this.error = error;
            this.team = undefined;
            this.isLoading = false;
            this.showErrorToast('Error loading selected team');
        }
    }

    // Getters for field values
    get teamName() {
        return this.team?.Name;
    }

    get teamCity() {
        return this.team?.City__c;
    }

    get teamStadium() {
        return this.team?.Stadium__c;
    }

    get teamFoundedYear() {
        return this.team?.Founded_Year__c;
    }

    get leagueName() {
        return this.team?.League__r?.Name;
    }

    get hasTeamData() {
        return this.team && !this.isLoading;
    }

    get showTeamSelector() {
        return !this.recordId && !this.isLoading && this.teams.length > 0;
    }

    // Helper method to show error toast
    showErrorToast(message) {
        const evt = new ShowToastEvent({
            title: 'Error',
            message: message,
            variant: 'error'
        });
        this.dispatchEvent(evt);
    }

    // Handle refresh action
    handleRefresh() {
        this.isLoading = true;
        if (this.recordId) {
            this.loadSelectedTeam();
        } else if (this.selectedTeamId) {
            this.loadSelectedTeam();
        } else {
            // Refresh teams list
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => {
                this.isLoading = false;
            }, 1000);
        }
    }
} 