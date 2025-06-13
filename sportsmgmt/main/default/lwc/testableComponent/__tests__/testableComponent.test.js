import { createElement } from 'lwc';
import TestableComponent from 'c/testableComponent';

describe('c-testable-component', () => {
    afterEach(() => {
        // The jsdom instance is shared across test cases in a single file so reset the DOM
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders the component', () => {
        const element = createElement('c-testable-component', {
            is: TestableComponent
        });

        document.body.appendChild(element);

        expect(element).toBeTruthy();
        expect(element.shadowRoot).not.toBeNull();
        expect(element.shadowRoot.children.length).toBe(0);
    });
});
