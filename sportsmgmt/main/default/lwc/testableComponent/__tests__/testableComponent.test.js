import { createElement } from 'lwc';
import TestableComponent from 'c/testableComponent';

describe('c-testable-component', () => {
    afterEach(() => {
        // The jsdom instance is shared across test cases in a single file so reset the DOM
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders the component', async () => {
        const element = createElement('c-testable-component', {
            is: TestableComponent
        });

        document.body.appendChild(element);

        // Wait for async rendering to complete
        await Promise.resolve();

        expect(element).toBeTruthy();
        expect(element.shadowRoot).not.toBeNull();
        
        // Since the template is currently empty, we should assert this explicitly
        // This makes the test intention clear and will fail if content is added later
        expect(element.shadowRoot.children.length).toBe(0);
        
        // Verify the component is properly connected to the DOM
        expect(element.isConnected).toBe(true);
    });

    it('has correct component structure', async () => {
        const element = createElement('c-testable-component', {
            is: TestableComponent
        });

        document.body.appendChild(element);

        // Wait for async rendering to complete
        await Promise.resolve();

        // Test that the component is an instance of the expected class
        expect(element instanceof TestableComponent).toBe(true);
        
        // Verify shadow DOM exists and is accessible
        expect(element.shadowRoot).toBeInstanceOf(ShadowRoot);
    });
});
