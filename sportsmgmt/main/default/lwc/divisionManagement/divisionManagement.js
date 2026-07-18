import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getAllDivisions from '@salesforce/apex/DivisionManagementController.getAllDivisions';
import createDivision from '@salesforce/apex/DivisionManagementController.createDivision';
import updateDivision from '@salesforce/apex/DivisionManagementController.updateDivision';
import deleteDivision from '@salesforce/apex/DivisionManagementController.deleteDivision';
import assignTeamToDivision from '@salesforce/apex/DivisionManagementController.assignTeamToDivision';
import getTeamsByDivision from '@salesforce/apex/DivisionManagementController.getTeamsByDivision';
import getAllTeams from '@salesforce/apex/TeamDetailsController.getAllTeams';

export default class DivisionManagement extends LightningElement {
    @track divisions = [];
    @track teams = [];
    @track filteredDivisions = [];
    @track selectedLeagueId = '';
    @track selectedDivisionId = '';
    @track selectedTeamId = '';
    @track divisionName = '';
    @track isLoading = false;
    @track showCreateModal = false;
    @track showEditModal = false;
    @track showDeleteModal = false;
    @track showAssignModal = false;
    @track editingDivision = {};
    @track deletingDivision = {};
    @track teamsInDivision = [];

    // Wire to get all divisions
    @wire(getAllDivisions)
    wiredDivisions(result) {
        this.divisionsWireResult = result;
        if (result.data) {
            this.divisions = result.data;
            this.filteredDivisions = [...this.divisions];
        } else if (result.error) {
            this.showErrorToast('Error loading divisions', result.error.body?.message || 'Unknown error');
        }
    }

    // Wire to get all teams
    @wire(getAllTeams)
    wiredTeams(result) {
        this.teamsWireResult = result;
        if (result.data) {
            this.teams = result.data;
        } else if (result.error) {
            this.showErrorToast('Error loading teams', result.error.body?.message || 'Unknown error');
        }
    }

    // Getters for UI
    get leagueOptions() {
        const leagues = new Map();
        this.divisions.forEach(division => {
            if (division.League__c && division.League__r) {
                leagues.set(division.League__c, division.League__r.Name);
            }
        });
        
        const options = [{ label: 'All Leagues', value: '' }];
        leagues.forEach((name, id) => {
            options.push({ label: name, value: id });
        });
        return options;
    }

    get teamOptions() {
        return [
            { label: '-- Select Team --', value: '' },
            ...this.teams.map(team => ({
                label: team.Name,
                value: team.Id
            }))
        ];
    }

    get divisionOptions() {
        return [
            { label: '-- Select Division --', value: '' },
            ...this.filteredDivisions.map(division => ({
                label: division.Name,
                value: division.Id
            }))
        ];
    }

    get hasFilteredDivisions() {
        return this.filteredDivisions.length > 0;
    }

    get hasTeamsInDivision() {
        return this.teamsInDivision.length > 0;
    }

    // Event handlers
    handleLeagueChange(event) {
        this.selectedLeagueId = event.detail.value;
        this.filterDivisionsByLeague();
    }

    handleDivisionChange(event) {
        this.selectedDivisionId = event.detail.value;
        this.loadTeamsInDivision();
    }

    handleTeamChange(event) {
        this.selectedTeamId = event.detail.value;
    }

    handleDivisionNameChange(event) {
        this.divisionName = event.detail.value;
    }

    // Filter divisions by selected league
    filterDivisionsByLeague() {
        if (this.selectedLeagueId) {
            this.filteredDivisions = this.divisions.filter(
                division => division.League__c === this.selectedLeagueId
            );
        } else {
            this.filteredDivisions = [...this.divisions];
        }
        
        // Reset selected division if it's not in the filtered list
        if (this.selectedDivisionId && 
            !this.filteredDivisions.find(d => d.Id === this.selectedDivisionId)) {
            this.selectedDivisionId = '';
            this.teamsInDivision = [];
        }
    }

    // Load teams in the selected division
    async loadTeamsInDivision() {
        if (!this.selectedDivisionId) {
            this.teamsInDivision = [];
            return;
        }

        this.isLoading = true;
        try {
            this.teamsInDivision = await getTeamsByDivision({ divisionId: this.selectedDivisionId });
        } catch (error) {
            this.showErrorToast('Error loading teams', error.body?.message || 'Unknown error');
            this.teamsInDivision = [];
        } finally {
            this.isLoading = false;
        }
    }

    // Modal handlers
    handleCreateDivision() {
        this.divisionName = '';
        this.showCreateModal = true;
    }

    handleEditDivision(event) {
        const divisionId = event.target.dataset.id;
        this.editingDivision = this.divisions.find(d => d.Id === divisionId);
        this.divisionName = this.editingDivision.Name;
        this.selectedLeagueId = this.editingDivision.League__c;
        this.showEditModal = true;
    }

    handleDeleteDivision(event) {
        const divisionId = event.target.dataset.id;
        this.deletingDivision = this.divisions.find(d => d.Id === divisionId);
        this.showDeleteModal = true;
    }

    handleAssignTeam() {
        if (!this.selectedLeagueId) {
            this.showErrorToast('Please select a league first');
            return;
        }
        this.showAssignModal = true;
    }

    // CRUD operations
    async handleSaveCreate() {
        if (!this.divisionName || !this.selectedLeagueId) {
            this.showErrorToast('Please provide division name and select a league');
            return;
        }

        this.isLoading = true;
        try {
            await createDivision({ 
                divisionName: this.divisionName, 
                leagueId: this.selectedLeagueId 
            });
            
            this.showSuccessToast('Division created successfully');
            this.closeCreateModal();
            this.refreshDivisions();
        } catch (error) {
            this.showErrorToast('Error creating division', error.body?.message || 'Unknown error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleSaveEdit() {
        if (!this.divisionName || !this.selectedLeagueId) {
            this.showErrorToast('Please provide division name and select a league');
            return;
        }

        this.isLoading = true;
        try {
            await updateDivision({ 
                divisionId: this.editingDivision.Id,
                divisionName: this.divisionName, 
                leagueId: this.selectedLeagueId 
            });
            
            this.showSuccessToast('Division updated successfully');
            this.closeEditModal();
            this.refreshDivisions();
        } catch (error) {
            this.showErrorToast('Error updating division', error.body?.message || 'Unknown error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleConfirmDelete() {
        this.isLoading = true;
        try {
            await deleteDivision({ divisionId: this.deletingDivision.Id });
            
            this.showSuccessToast('Division deleted successfully');
            this.closeDeleteModal();
            this.refreshDivisions();
        } catch (error) {
            this.showErrorToast('Error deleting division', error.body?.message || 'Unknown error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleAssignTeamToDivision() {
        if (!this.selectedTeamId || !this.selectedDivisionId) {
            this.showErrorToast('Please select both team and division');
            return;
        }

        this.isLoading = true;
        try {
            await assignTeamToDivision({ 
                teamId: this.selectedTeamId, 
                divisionId: this.selectedDivisionId 
            });
            
            this.showSuccessToast('Team assigned to division successfully');
            this.closeAssignModal();
            this.loadTeamsInDivision();
        } catch (error) {
            this.showErrorToast('Error assigning team', error.body?.message || 'Unknown error');
        } finally {
            this.isLoading = false;
        }
    }

    // Modal close handlers
    closeCreateModal() {
        this.showCreateModal = false;
        this.divisionName = '';
        this.selectedLeagueId = '';
    }

    closeEditModal() {
        this.showEditModal = false;
        this.divisionName = '';
        this.selectedLeagueId = '';
        this.editingDivision = {};
    }

    closeDeleteModal() {
        this.showDeleteModal = false;
        this.deletingDivision = {};
    }

    closeAssignModal() {
        this.showAssignModal = false;
        this.selectedTeamId = '';
        this.selectedDivisionId = '';
    }

    // Utility methods
    async refreshDivisions() {
        await refreshApex(this.divisionsWireResult);
        this.filterDivisionsByLeague();
    }

    showSuccessToast(message) {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Success',
            message: message,
            variant: 'success'
        }));
    }

    showErrorToast(title, message = '') {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: 'error'
        }));
    }
} 