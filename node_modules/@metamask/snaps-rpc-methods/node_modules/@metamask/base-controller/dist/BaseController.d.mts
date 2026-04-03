import type { Json, PublicInterface } from "@metamask/utils";
import type { Draft, Patch } from "immer";
import type { ActionConstraint, EventConstraint } from "./Messenger.mjs";
import type { RestrictedMessenger, RestrictedMessengerConstraint } from "./RestrictedMessenger.mjs";
/**
 * Determines if the given controller is an instance of `BaseController`
 *
 * @param controller - Controller instance to check
 * @returns True if the controller is an instance of `BaseController`
 */
export declare function isBaseController(controller: unknown): controller is BaseControllerInstance;
/**
 * A type that constrains the state of all controllers.
 *
 * In other words, the narrowest supertype encompassing all controller state.
 */
export type StateConstraint = Record<string, Json>;
/**
 * A state change listener.
 *
 * This function will get called for each state change, and is given a copy of
 * the new state along with a set of patches describing the changes since the
 * last update.
 *
 * @param state - The new controller state.
 * @param patches - A list of patches describing any changes (see here for more
 * information: https://immerjs.github.io/immer/docs/patches)
 */
export type Listener<T> = (state: T, patches: Patch[]) => void;
/**
 * An function to derive state.
 *
 * This function will accept one piece of the controller state (one property),
 * and will return some derivation of that state.
 *
 * @param value - A piece of controller state.
 * @returns Something derived from controller state.
 */
export type StateDeriver<T extends Json> = (value: T) => Json;
/**
 * State metadata.
 *
 * This metadata describes which parts of state should be persisted, and how to
 * get an anonymized representation of the state.
 */
export type StateMetadata<T extends StateConstraint> = {
    [P in keyof T]-?: StatePropertyMetadata<T[P]>;
};
/**
 * Metadata for a single state property
 */
export type StatePropertyMetadata<ControllerState extends Json> = {
    /**
     * Indicates whether this property should be included in debug snapshots attached to Sentry
     * errors.
     *
     * Set this to false if the state may contain personally identifiable information, or if it's
     * too large to include in a debug snapshot.
     */
    anonymous: boolean | StateDeriver<ControllerState>;
    /**
     * Indicates whether this property should be included in state logs.
     *
     * Set this to false if the data should be kept hidden from support agents (e.g. if it contains
     * secret keys, or personally-identifiable information that is not useful for debugging).
     *
     * We do allow state logs to contain some personally identifiable information to assist with
     * diagnosing errors (e.g. transaction hashes, addresses), but we still attempt to limit the
     * data we expose to what is most useful for helping users.
     */
    includeInStateLogs?: boolean | StateDeriver<ControllerState>;
    /**
     * Indicates whether this property should be persisted.
     *
     * If true, the property will be persisted and saved between sessions.
     * If false, the property will not be saved between sessions, and it will always be missing from the `state` constructor parameter.
     */
    persist: boolean | StateDeriver<ControllerState>;
    /**
     * Indicates whether this property is used by the UI.
     *
     * If true, the property will be accessible from the UI.
     * If false, it will be inaccessible from the UI.
     *
     * Making a property accessible to the UI has a performance overhead, so it's better to set this
     * to `false` if it's not used in the UI, especially for properties that can be large in size.
     *
     * Note that we disallow the use of a state derivation function here to preserve type information
     * for the UI (the state deriver type always returns `Json`).
     */
    usedInUi?: boolean;
};
/**
 * A universal supertype of `StateDeriver` types.
 * This type can be assigned to any `StateDeriver` type.
 */
export type StateDeriverConstraint = (value: never) => Json;
/**
 * A universal supertype of `StatePropertyMetadata` types.
 * This type can be assigned to any `StatePropertyMetadata` type.
 */
export type StatePropertyMetadataConstraint = {
    anonymous: boolean | StateDeriverConstraint;
    includeInStateLogs?: boolean | StateDeriverConstraint;
    persist: boolean | StateDeriverConstraint;
    usedInUi?: boolean;
};
/**
 * A universal supertype of `StateMetadata` types.
 * This type can be assigned to any `StateMetadata` type.
 */
export type StateMetadataConstraint = Record<string, StatePropertyMetadataConstraint>;
/**
 * The widest subtype of all controller instances that inherit from `BaseController` (formerly `BaseControllerV2`).
 * Any `BaseController` subclass instance can be assigned to this type.
 */
export type BaseControllerInstance = Omit<PublicInterface<BaseController<string, StateConstraint, RestrictedMessengerConstraint>>, 'metadata'> & {
    metadata: StateMetadataConstraint;
};
export type ControllerGetStateAction<ControllerName extends string, ControllerState extends StateConstraint> = {
    type: `${ControllerName}:getState`;
    handler: () => ControllerState;
};
export type ControllerStateChangeEvent<ControllerName extends string, ControllerState extends StateConstraint> = {
    type: `${ControllerName}:stateChange`;
    payload: [ControllerState, Patch[]];
};
export type ControllerActions<ControllerName extends string, ControllerState extends StateConstraint> = ControllerGetStateAction<ControllerName, ControllerState>;
export type ControllerEvents<ControllerName extends string, ControllerState extends StateConstraint> = ControllerStateChangeEvent<ControllerName, ControllerState>;
/**
 * Controller class that provides state management, subscriptions, and state metadata
 */
export declare class BaseController<ControllerName extends string, ControllerState extends StateConstraint, messenger extends RestrictedMessenger<ControllerName, ActionConstraint | ControllerActions<ControllerName, ControllerState>, EventConstraint | ControllerEvents<ControllerName, ControllerState>, string, string>> {
    #private;
    protected messagingSystem: messenger;
    /**
     * The name of the controller.
     *
     * This is used by the ComposableController to construct a composed application state.
     */
    readonly name: ControllerName;
    readonly metadata: StateMetadata<ControllerState>;
    /**
     * Creates a BaseController instance.
     *
     * @param options - Controller options.
     * @param options.messenger - Controller messaging system.
     * @param options.metadata - ControllerState metadata, describing how to "anonymize" the state, and which
     * parts should be persisted.
     * @param options.name - The name of the controller, used as a namespace for events and actions.
     * @param options.state - Initial controller state.
     */
    constructor({ messenger, metadata, name, state, }: {
        messenger: messenger;
        metadata: StateMetadata<ControllerState>;
        name: ControllerName;
        state: ControllerState;
    });
    /**
     * Retrieves current controller state.
     *
     * @returns The current state.
     */
    get state(): ControllerState;
    set state(_: ControllerState);
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
    protected update(callback: (state: Draft<ControllerState>) => void | ControllerState): {
        nextState: ControllerState;
        patches: Patch[];
        inversePatches: Patch[];
    };
    /**
     * Applies immer patches to the current state. The patches come from the
     * update function itself and can either be normal or inverse patches.
     *
     * @param patches - An array of immer patches that are to be applied to make
     * or undo changes.
     */
    protected applyPatches(patches: Patch[]): void;
    /**
     * Prepares the controller for garbage collection. This should be extended
     * by any subclasses to clean up any additional connections or events.
     *
     * The only cleanup performed here is to remove listeners. While technically
     * this is not required to ensure this instance is garbage collected, it at
     * least ensures this instance won't be responsible for preventing the
     * listeners from being garbage collected.
     */
    protected destroy(): void;
}
/**
 * Returns an anonymized representation of the controller state.
 *
 * By "anonymized" we mean that it should not contain any information that could be personally
 * identifiable.
 *
 * @deprecated Use `deriveStateFromMetadata` instead.
 * @param state - The controller state.
 * @param metadata - The controller state metadata, which describes how to derive the
 * anonymized state.
 * @param captureException - Reports an error to an error monitoring service.
 * @returns The anonymized controller state.
 */
export declare function getAnonymizedState<ControllerState extends StateConstraint>(state: ControllerState, metadata: StateMetadata<ControllerState>, captureException?: (error: Error) => void): Record<keyof ControllerState, Json>;
/**
 * Returns the subset of state that should be persisted.
 *
 * @deprecated Use `deriveStateFromMetadata` instead.
 * @param state - The controller state.
 * @param metadata - The controller state metadata, which describes which pieces of state should be persisted.
 * @param captureException - Reports an error to an error monitoring service.
 * @returns The subset of controller state that should be persisted.
 */
export declare function getPersistentState<ControllerState extends StateConstraint>(state: ControllerState, metadata: StateMetadata<ControllerState>, captureException?: (error: Error) => void): Record<keyof ControllerState, Json>;
/**
 * Use the metadata to derive state according to the given metadata property.
 *
 * @param state - The full controller state.
 * @param metadata - The controller metadata.
 * @param metadataProperty - The metadata property to use to derive state.
 * @param captureException - Reports an error to an error monitoring service.
 * @returns The metadata-derived controller state.
 */
export declare function deriveStateFromMetadata<ControllerState extends StateConstraint>(state: ControllerState, metadata: StateMetadata<ControllerState>, metadataProperty: keyof StatePropertyMetadata<Json>, captureException?: (error: Error) => void): Record<keyof ControllerState, Json>;
//# sourceMappingURL=BaseController.d.mts.map