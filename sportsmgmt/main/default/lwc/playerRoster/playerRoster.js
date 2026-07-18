import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getAllPlayers from '@salesforce/apex/PlayerRosterController.getAllPlayers';
import getAllTeams from '@salesforce/apex/TeamDetailsController.getAllTeams';
import createPlayer from '@salesforce/apex/PlayerRosterController.createPlayer';
import updatePlayer from '@salesforce/apex/PlayerRosterController.updatePlayer';
import deletePlayer from '@salesforce/apex/PlayerRosterController.deletePlayer';

export default class PlayerRoster extends LightningElement {
    @track players = [];
    @track filteredPlayers = [];
    @track teams = [];
    @track selectedTeamId = '';
    @track playerName = '';
    @track teamId = '';
    @track position = '';
    @track jerseyNumber = null;
    @track dateOfBirth = '';
    @track statusValue = '';
    @track isLoading = false;
    @track showCreateModal = false;
    @track showEditModal = false;
    @track showDeleteModal = false;
    @track editingPlayer = {};
    @track deletingPlayer = {};

    // Wire to get all players
    @wire(getAllPlayers)
    wiredPlayers(result) {
        this.playersWireResult = result;
        if (result.data) {
            this.players = result.data;
            this.filterPlayersByTeam();
        } else if (result.error) {
            this.showErrorToast('Error loading players', result.error.body?.message || 'Unknown error');
        }
    }

    // Wire to get all teams for filter/combobox
    @wire(getAllTeams)
    wiredTeams(result) {
        if (result.data) {
            this.teams = result.data;
        } else if (result.error) {
            this.showErrorToast('Error loading teams', result.error.body?.message || 'Unknown error');
        }
    }

    // Getters for UI
    get teamOptions() {
        const options = [{ label: 'All Teams', value: '' }];
        this.teams.forEach(team => {
            options.push({ label: team.Name, value: team.Id });
        });
        return options;
    }

    get teamSelectOptions() {
        return this.teams.map(team => ({
            label: team.Name,
            value: team.Id
        }));
    }

    get statusOptions() {
        return [
            { label: 'Active', value: 'Active' },
            { label: 'Injured', value: 'Injured' },
            { label: 'Inactive', value: 'Inactive' }
        ];
    }

    get hasFilteredPlayers() {
        return this.filteredPlayers.length > 0;
    }

    // Event handlers
    handleTeamFilterChange(event) {
        this.selectedTeamId = event.detail.value;
        this.filterPlayersByTeam();
    }

    handlePlayerNameChange(event) {
        this.playerName = event.detail.value;
    }

    handleTeamChange(event) {
        this.teamId = event.detail.value;
    }

    handlePositionChange(event) {
        this.position = event.detail.value;
    }

    handleJerseyNumberChange(event) {
        this.jerseyNumber = event.detail.value;
    }

    handleDateOfBirthChange(event) {
        this.dateOfBirth = event.detail.value;
    }

    handleStatusChange(event) {
        this.statusValue = event.detail.value;
    }

    // Filter players by selected team
    filterPlayersByTeam() {
        if (this.selectedTeamId) {
            this.filteredPlayers = this.players.filter(
                player => player.Team__c === this.selectedTeamId
            );
        } else {
            this.filteredPlayers = [...this.players];
        }
    }

    // Modal handlers
    handleCreatePlayer() {
        this.playerName = '';
        this.teamId = '';
        this.position = '';
        this.jerseyNumber = null;
        this.dateOfBirth = '';
        this.statusValue = '';
        this.showCreateModal = true;
    }

    handleEditPlayer(event) {
        const playerId = event.target.dataset.id;
        this.editingPlayer = this.players.find(p => p.Id === playerId);
        this.playerName = this.editingPlayer.Name;
        this.teamId = this.editingPlayer.Team__c;
        this.position = this.editingPlayer.Position__c || '';
        this.jerseyNumber = this.editingPlayer.Jersey_Number__c;
        this.dateOfBirth = this.editingPlayer.Date_of_Birth__c || '';
        this.statusValue = this.editingPlayer.Status__c || '';
        this.showEditModal = true;
    }

    handleDeletePlayer(event) {
        const playerId = event.target.dataset.id;
        this.deletingPlayer = this.players.find(p => p.Id === playerId);
        this.showDeleteModal = true;
    }

    // CRUD operations
    async handleSaveCreate() {
        if (!this.playerName || !this.teamId) {
            this.showErrorToast('Please provide player name and select a team');
            return;
        }

        this.isLoading = true;
        try {
            await createPlayer({
                playerName: this.playerName,
                teamId: this.teamId,
                position: this.position || null,
                jerseyNumber: this.jerseyNumber || null,
                dateOfBirth: this.dateOfBirth || null,
                status: this.statusValue || null
            });

            this.showSuccessToast('Player created successfully');
            this.closeCreateModal();
            this.refreshPlayers();
        } catch (error) {
            this.showErrorToast('Error creating player', error.body?.message || 'Unknown error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleSaveEdit() {
        if (!this.playerName || !this.teamId) {
            this.showErrorToast('Please provide player name and select a team');
            return;
        }

        this.isLoading = true;
        try {
            await updatePlayer({
                playerId: this.editingPlayer.Id,
                playerName: this.playerName,
                teamId: this.teamId,
                position: this.position || null,
                jerseyNumber: this.jerseyNumber || null,
                dateOfBirth: this.dateOfBirth || null,
                status: this.statusValue || null
            });

            this.showSuccessToast('Player updated successfully');
            this.closeEditModal();
            this.refreshPlayers();
        } catch (error) {
            this.showErrorToast('Error updating player', error.body?.message || 'Unknown error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleConfirmDelete() {
        this.isLoading = true;
        try {
            await deletePlayer({ playerId: this.deletingPlayer.Id });

            this.showSuccessToast('Player deleted successfully');
            this.closeDeleteModal();
            this.refreshPlayers();
        } catch (error) {
            this.showErrorToast('Error deleting player', error.body?.message || 'Unknown error');
        } finally {
            this.isLoading = false;
        }
    }

    // Modal close handlers
    closeCreateModal() {
        this.showCreateModal = false;
        this.playerName = '';
        this.teamId = '';
        this.position = '';
        this.jerseyNumber = null;
        this.dateOfBirth = '';
        this.statusValue = '';
    }

    closeEditModal() {
        this.showEditModal = false;
        this.playerName = '';
        this.teamId = '';
        this.position = '';
        this.jerseyNumber = null;
        this.dateOfBirth = '';
        this.statusValue = '';
        this.editingPlayer = {};
    }

    closeDeleteModal() {
        this.showDeleteModal = false;
        this.deletingPlayer = {};
    }

    // Utility methods
    async refreshPlayers() {
        await refreshApex(this.playersWireResult);
        this.filterPlayersByTeam();
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
