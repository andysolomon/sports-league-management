export const NavigationMixin = (Base) => {
    return class extends Base {
        navigate() {}
    };
};
NavigationMixin.Navigate = jest.fn();