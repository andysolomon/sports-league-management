import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getAllSeasons from '@salesforce/apex/SeasonManagementController.getAllSeasons';
import createSeason from '@salesforce/apex/SeasonManagementController.createSeason';
import updateSeason from '@salesforce/apex/SeasonManagementController.updateSeason';
import deleteSeason from '@salesforce/apex/SeasonManagementController.deleteSeason';

export default class SeasonManagement extends LightningElement {
    @track seasons = [];
    @track filteredSeasons = [];
    @track selectedLeagueId = '';
    @track seasonName = '';
    @track startDate = '';
    @track endDate = '';
    @track statusValue = '';
    @track isLoading = false;
    @track showCreateModal = false;
    @track showEditModal = false;
    @track showDeleteModal = false;
    @track editingSeason = {};
    @track deletingSeason = {};

    // Wire to get all seasons
    @wire(getAllSeasons)
    wiredSeasons(result) {
        this.seasonsWireResult = result;
        if (result.data) {
            this.seasons = result.data;
            this.filteredSeasons = [...this.seasons];
        } else if (result.error) {
            this.showErrorToast('Error loading seasons', result.error.body?.message || 'Unknown error');
        }
    }

    // Getters for UI
    get leagueOptions() {
        const leagues = new Map();
        this.seasons.forEach(season => {
            if (season.League__c && season.League__r) {
                leagues.set(season.League__c, season.League__r.Name);
            }
        });

        const options = [{ label: 'All Leagues', value: '' }];
        leagues.forEach((name, id) => {
            options.push({ label: name, value: id });
        });
        return options;
    }

    get statusOptions() {
        return [
            { label: 'Upcoming', value: 'Upcoming' },
            { label: 'Active', value: 'Active' },
            { label: 'Completed', value: 'Completed' }
        ];
    }

    get hasFilteredSeasons() {
        return this.filteredSeasons.length > 0;
    }

    // Event handlers
    handleLeagueChange(event) {
        this.selectedLeagueId = event.detail.value;
        this.filterSeasonsByLeague();
    }

    handleSeasonNameChange(event) {
        this.seasonName = event.detail.value;
    }

    handleStartDateChange(event) {
        this.startDate = event.detail.value;
    }

    handleEndDateChange(event) {
        this.endDate = event.detail.value;
    }

    handleStatusChange(event) {
        this.statusValue = event.detail.value;
    }

    handleCreateLeagueChange(event) {
        this.selectedLeagueId = event.detail.value;
    }

    // Filter seasons by selected league
    filterSeasonsByLeague() {
        if (this.selectedLeagueId) {
            this.filteredSeasons = this.seasons.filter(
                season => season.League__c === this.selectedLeagueId
            );
        } else {
            this.filteredSeasons = [...this.seasons];
        }
    }

    // Modal handlers
    handleCreateSeason() {
        this.seasonName = '';
        this.startDate = '';
        this.endDate = '';
        this.statusValue = '';
        this.showCreateModal = true;
    }

    handleEditSeason(event) {
        const seasonId = event.target.dataset.id;
        this.editingSeason = this.seasons.find(s => s.Id === seasonId);
        this.seasonName = this.editingSeason.Name;
        this.selectedLeagueId = this.editingSeason.League__c;
        this.startDate = this.editingSeason.Start_Date__c;
        this.endDate = this.editingSeason.End_Date__c;
        this.statusValue = this.editingSeason.Status__c;
        this.showEditModal = true;
    }

    handleDeleteSeason(event) {
        const seasonId = event.target.dataset.id;
        this.deletingSeason = this.seasons.find(s => s.Id === seasonId);
        this.showDeleteModal = true;
    }

    // CRUD operations
    async handleSaveCreate() {
        if (!this.seasonName || !this.selectedLeagueId) {
            this.showErrorToast('Please provide season name and select a league');
            return;
        }

        this.isLoading = true;
        try {
            await createSeason({
                seasonName: this.seasonName,
                leagueId: this.selectedLeagueId,
                startDate: this.startDate || null,
                endDate: this.endDate || null,
                status: this.statusValue || null
            });

            this.showSuccessToast('Season created successfully');
            this.closeCreateModal();
            this.refreshSeasons();
        } catch (error) {
            this.showErrorToast('Error creating season', error.body?.message || 'Unknown error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleSaveEdit() {
        if (!this.seasonName || !this.selectedLeagueId) {
            this.showErrorToast('Please provide season name and select a league');
            return;
        }

        this.isLoading = true;
        try {
            await updateSeason({
                seasonId: this.editingSeason.Id,
                seasonName: this.seasonName,
                leagueId: this.selectedLeagueId,
                startDate: this.startDate || null,
                endDate: this.endDate || null,
                status: this.statusValue || null
            });

            this.showSuccessToast('Season updated successfully');
            this.closeEditModal();
            this.refreshSeasons();
        } catch (error) {
            this.showErrorToast('Error updating season', error.body?.message || 'Unknown error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleConfirmDelete() {
        this.isLoading = true;
        try {
            await deleteSeason({ seasonId: this.deletingSeason.Id });

            this.showSuccessToast('Season deleted successfully');
            this.closeDeleteModal();
            this.refreshSeasons();
        } catch (error) {
            this.showErrorToast('Error deleting season', error.body?.message || 'Unknown error');
        } finally {
            this.isLoading = false;
        }
    }

    // Modal close handlers
    closeCreateModal() {
        this.showCreateModal = false;
        this.seasonName = '';
        this.startDate = '';
        this.endDate = '';
        this.statusValue = '';
    }

    closeEditModal() {
        this.showEditModal = false;
        this.seasonName = '';
        this.startDate = '';
        this.endDate = '';
        this.statusValue = '';
        this.selectedLeagueId = '';
        this.editingSeason = {};
    }

    closeDeleteModal() {
        this.showDeleteModal = false;
        this.deletingSeason = {};
    }

    // Utility methods
    async refreshSeasons() {
        await refreshApex(this.seasonsWireResult);
        this.filterSeasonsByLeague();
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