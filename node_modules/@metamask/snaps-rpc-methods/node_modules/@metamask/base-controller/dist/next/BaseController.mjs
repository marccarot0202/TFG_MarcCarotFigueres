var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _BaseController_internalState, _BaseController_messenger;
import { enablePatches, produceWithPatches, applyPatches, freeze } from "immer";
enablePatches();
/**
 * Controller class that provides state management, subscriptions, and state metadata
 */
export class BaseController {
    /**
     * Creates a BaseController instance.
     *
     * @param options - Controller options.
     * @param options.messenger - The controller messenger.
     * @param options.metadata - ControllerState metadata, describing how to "anonymize" the state, and which
     * parts should be persisted.
     * @param options.name - The name of the controller, used as a namespace for events and actions.
     * @param options.state - Initial controller state.
     */
    constructor({ messenger, metadata, name, state, }) {
        /**
         * The controller state.
         */
        _BaseController_internalState.set(this, void 0);
        /**
         * The controller messenger.
         *
         * This is the same as the `messagingSystem` property, but has a type that only lets us use
         * actions and events that are part of the `BaseController` class.
         */
        _BaseController_messenger.set(this, void 0);
        // The parameter type validates that the expected actions/events are present
        // We don't have a way to validate the type property because the type is invariant
        __classPrivateFieldSet(this, _BaseController_messenger, messenger, "f");
        this.messenger = messenger;
        this.name = name;
        // Here we use `freeze` from Immer to enforce that the state is deeply
        // immutable. Note that this is a runtime check, not a compile-time check.
        // That is, unlike `Object.freeze`, this does not narrow the type
        // recursively to `Readonly`. The equivalent in Immer is `Immutable`, but
        // `Immutable` does not handle recursive types such as our `Json` type.
        __classPrivateFieldSet(this, _BaseController_internalState, freeze(state, true), "f");
        this.metadata = metadata;
        __classPrivateFieldGet(this, _BaseController_messenger, "f").registerActionHandler(`${name}:getState`, () => this.state);
        __classPrivateFieldGet(this, _BaseController_messenger, "f").registerInitialEventPayload({
            eventType: `${name}:stateChange`,
            getPayload: () => [this.state, []],
        });
    }
    /**
     * Retrieves current controller state.
     *
     * @returns The current state.
     */
    get state() {
        return __classPrivateFieldGet(this, _BaseController_internalState, "f");
    }
    set state(_) {
        throw new Error(`Controller state cannot be directly mutated; use 'update' method instead.`);
    }
    /**
     * Updates controller state. Accepts a callback that is passed a draft copy
     * of the controller state. If a value is returned, it is set as the new
     * state. Otherwise, any changes made within that callback to the draft are
     * applied to the controller state.
     *
     * @param callback - Callback for updating state, passed a draft state
     * object. Return a new state object or mutate the draft to update state.
     * @returns An object that has the next state, patches applied in the update and inverse patches to
     * rollback the update.
     */
    update(callback) {
        // We run into ts2589, "infinite type depth", if we don't cast
        // produceWithPatches here.
        const [nextState, patches, inversePatches] = produceWithPatches(__classPrivateFieldGet(this, _BaseController_internalState, "f"), callback);
        // Protect against unnecessary state updates when there is no state diff.
        if (patches.length > 0) {
            __classPrivateFieldSet(this, _BaseController_internalState, nextState, "f");
            __classPrivateFieldGet(this, _BaseController_messenger, "f").publish(`${this.name}:stateChange`, nextState, patches);
        }
        return { nextState, patches, inversePatches };
    }
    /**
     * Applies immer patches to the current state. The patches come from the
     * update function itself and can either be normal or inverse patches.
     *
     * @param patches - An array of immer patches that are to be applied to make
     * or undo changes.
     */
    applyPatches(patches) {
        const nextState = applyPatches(__classPrivateFieldGet(this, _BaseController_internalState, "f"), patches);
        __classPrivateFieldSet(this, _BaseController_internalState, nextState, "f");
        __classPrivateFieldGet(this, _BaseController_messenger, "f").publish(`${this.name}:stateChange`, nextState, patches);
    }
    /**
     * Prepares the controller for garbage collection. This should be extended
     * by any subclasses to clean up any additional connections or events.
     *
     * The only cleanup performed here is to remove listeners. While technically
     * this is not required to ensure this instance is garbage collected, it at
     * least ensures this instance won't be responsible for preventing the
     * listeners from being garbage collected.
     */
    destroy() {
        this.messenger.clearEventSubscriptions(`${this.name}:stateChange`);
    }
}
_BaseController_internalState = new WeakMap(), _BaseController_messenger = new WeakMap();
/**
 * Use the metadata to derive state according to the given metadata property.
 *
 * @param state - The full controller state.
 * @param metadata - The controller metadata.
 * @param metadataProperty - The metadata property to use to derive state.
 * @param captureException - Reports an error to an error monitoring service.
 * @returns The metadata-derived controller state.
 */
export function deriveStateFromMetadata(state, metadata, metadataProperty, captureException) {
    return Object.keys(state).reduce((derivedState, key) => {
        try {
            const stateMetadata = metadata[key];
            if (!stateMetadata) {
                throw new Error(`No metadata found for '${String(key)}'`);
            }
            const propertyMetadata = stateMetadata[metadataProperty];
            const stateProperty = state[key];
            if (typeof propertyMetadata === 'function') {
                derivedState[key] = propertyMetadata(stateProperty);
            }
            else if (propertyMetadata) {
                derivedState[key] = stateProperty;
            }
            return derivedState;
        }
        catch (error) {
            // Capture error without interrupting state-related operations
            // See [ADR core#0016](https://github.com/MetaMask/decisions/blob/main/decisions/core/0016-core-classes-error-reporting.md)
            if (captureException) {
                try {
                    captureException(error instanceof Error ? error : new Error(String(error)));
                }
                catch (captureExceptionError) {
                    console.error(new Error(`Error thrown when calling 'captureException'`), captureExceptionError);
                    console.error(error);
                }
            }
            else {
                console.error(error);
            }
            return derivedState;
        }
    }, {});
}
//# sourceMappingURL=BaseController.mjs.map