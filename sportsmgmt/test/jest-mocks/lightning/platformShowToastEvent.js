/**
 * Mock for lightning/platformShowToastEvent
 */

export const ShowToastEventName = 'lightning__showtoast';

export class ShowToastEvent extends CustomEvent {
    constructor(eventInitDict) {
        super(ShowToastEventName, {
            composed: true,
            cancelable: true,
            bubbles: true,
            detail: eventInitDict
        });
    }
}