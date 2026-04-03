"use strict";
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
var _RestrictedMessenger_instances, _RestrictedMessenger_messenger, _RestrictedMessenger_namespace, _RestrictedMessenger_allowedActions, _RestrictedMessenger_allowedEvents, _RestrictedMessenger_isAllowedEvent, _RestrictedMessenger_isAllowedAction, _RestrictedMessenger_isInCurrentNamespace;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestrictedMessenger = void 0;
/**
 * A restricted messenger.
 *
 * This acts as a wrapper around the messenger instance that restricts access to actions
 * and events.
 *
 * @template Namespace - The namespace for this messenger. Typically this is the name of the controller or
 * module that this messenger has been created for. The authority to publish events and register
 * actions under this namespace is granted to this restricted messenger instance.
 * @template Action - A type union of all Action types.
 * @template Event - A type union of all Event types.
 * @template AllowedAction - A type union of the 'type' string for any allowed actions.
 * This must not include internal actions that are in the messenger's namespace.
 * @template AllowedEvent - A type union of the 'type' string for any allowed events.
 * This must not include internal events that are in the messenger's namespace.
 */
class RestrictedMessenger {
    /**
     * Constructs a restricted messenger
     *
     * The provided allowlists grant the ability to call the listed actions and subscribe to the
     * listed events. The "name" provided grants ownership of any actions and events under that
     * namespace. Ownership allows registering actions and publishing events, as well as
     * unregistering actions and clearing event subscriptions.
     *
     * @param options - Options.
     * @param options.messenger - The messenger instance that is being wrapped.
     * @param options.name - The name of the thing this messenger will be handed to (e.g. the
     * controller name). This grants "ownership" of actions and events under this namespace to the
     * restricted messenger returned.
     * @param options.allowedActions - The list of actions that this restricted messenger should be
     * allowed to call.
     * @param options.allowedEvents - The list of events that this restricted messenger should be
     * allowed to subscribe to.
     */
    constructor({ messenger, name, allowedActions, allowedEvents, }) {
        _RestrictedMessenger_instances.add(this);
        _RestrictedMessenger_messenger.set(this, void 0);
        _RestrictedMessenger_namespace.set(this, void 0);
        _RestrictedMessenger_allowedActions.set(this, void 0);
        _RestrictedMessenger_allowedEvents.set(this, void 0);
        if (!messenger) {
            throw new Error('Messenger not provided');
        }
        // The above condition guarantees that one of these options is defined.
        __classPrivateFieldSet(this, _RestrictedMessenger_messenger, messenger, "f");
        __classPrivateFieldSet(this, _RestrictedMessenger_namespace, name, "f");
        __classPrivateFieldSet(this, _RestrictedMessenger_allowedActions, allowedActions, "f");
        __classPrivateFieldSet(this, _RestrictedMessenger_allowedEvents, allowedEvents, "f");
    }
    /**
     * Register an action handler.
     *
     * This will make the registered function available to call via the `call` method.
     *
     * The action type this handler is registered under *must* be in the current namespace.
     *
     * @param action - The action type. This is a unique identifier for this action.
     * @param handler - The action handler. This function gets called when the `call` method is
     * invoked with the given action type.
     * @throws Will throw if an action handler that is not in the current namespace is being registered.
     * @template ActionType - A type union of Action type strings that are namespaced by Namespace.
     */
    registerActionHandler(action, handler) {
        /* istanbul ignore if */ // Branch unreachable with valid types
        if (!__classPrivateFieldGet(this, _RestrictedMessenger_instances, "m", _RestrictedMessenger_isInCurrentNamespace).call(this, action)) {
            throw new Error(`Only allowed registering action handlers prefixed by '${__classPrivateFieldGet(this, _RestrictedMessenger_namespace, "f")}:'`);
        }
        __classPrivateFieldGet(this, _RestrictedMessenger_messenger, "f").registerActionHandler(action, handler);
    }
    /**
     * Registers action handlers for a list of methods on a messenger client
     *
     * @param messengerClient - The object that is expected to make use of the messenger.
     * @param methodNames - The names of the methods on the messenger client to register as action
     * handlers.
     * @template MessengerClient - The type expected to make use of the messenger.
     * @template MethodNames - The type union of method names to register as action handlers.
     */
    registerMethodActionHandlers(messengerClient, methodNames) {
        __classPrivateFieldGet(this, _RestrictedMessenger_messenger, "f").registerMethodActionHandlers(messengerClient, methodNames);
    }
    /**
     * Unregister an action handler.
     *
     * This will prevent this action from being called.
     *
     * The action type being unregistered *must* be in the current namespace.
     *
     * @param action - The action type. This is a unique identifier for this action.
     * @throws Will throw if an action handler that is not in the current namespace is being unregistered.
     * @template ActionType - A type union of Action type strings that are namespaced by Namespace.
     */
    unregisterActionHandler(action) {
        /* istanbul ignore if */ // Branch unreachable with valid types
        if (!__classPrivateFieldGet(this, _RestrictedMessenger_instances, "m", _RestrictedMessenger_isInCurrentNamespace).call(this, action)) {
            throw new Error(`Only allowed unregistering action handlers prefixed by '${__classPrivateFieldGet(this, _RestrictedMessenger_namespace, "f")}:'`);
        }
        __classPrivateFieldGet(this, _RestrictedMessenger_messenger, "f").unregisterActionHandler(action);
    }
    /**
     * Call an action.
     *
     * This function will call the action handler corresponding to the given action type, passing
     * along any parameters given.
     *
     * The action type being called must be on the action allowlist.
     *
     * @param actionType - The action type. This is a unique identifier for this action.
     * @param params - The action parameters. These must match the type of the parameters of the
     * registered action handler.
     * @throws Will throw when no handler has been registered for the given type.
     * @template ActionType - A type union of allowed Action type strings.
     * @returns The action return value.
     */
    call(actionType, ...params) {
        if (!__classPrivateFieldGet(this, _RestrictedMessenger_instances, "m", _RestrictedMessenger_isAllowedAction).call(this, actionType)) {
            throw new Error(`Action missing from allow list: ${actionType}`);
        }
        const response = __classPrivateFieldGet(this, _RestrictedMessenger_messenger, "f").call(actionType, ...params);
        return response;
    }
    /**
     * Register a function for getting the initial payload for an event.
     *
     * This is used for events that represent a state change, where the payload is the state.
     * Registering a function for getting the payload allows event selectors to have a point of
     * comparison the first time state changes.
     *
     * The event type *must* be in the current namespace
     *
     * @param args - The arguments to this function
     * @param args.eventType - The event type to register a payload for.
     * @param args.getPayload - A function for retrieving the event payload.
     * @template EventType - A type union of Event type strings.
     */
    registerInitialEventPayload({ eventType, getPayload, }) {
        /* istanbul ignore if */ // Branch unreachable with valid types
        if (!__classPrivateFieldGet(this, _RestrictedMessenger_instances, "m", _RestrictedMessenger_isInCurrentNamespace).call(this, eventType)) {
            throw new Error(`Only allowed publishing events prefixed by '${__classPrivateFieldGet(this, _RestrictedMessenger_namespace, "f")}:'`);
        }
        __classPrivateFieldGet(this, _RestrictedMessenger_messenger, "f").registerInitialEventPayload({
            eventType,
            getPayload,
        });
    }
    /**
     * Publish an event.
     *
     * Publishes the given payload to all subscribers of the given event type.
     *
     * The event type being published *must* be in the current namespace.
     *
     * @param event - The event type. This is a unique identifier for this event.
     * @param payload - The event payload. The type of the parameters for each event handler must
     * match the type of this payload.
     * @throws Will throw if an event that is not in the current namespace is being published.
     * @template EventType - A type union of Event type strings that are namespaced by Namespace.
     */
    publish(event, ...payload) {
        /* istanbul ignore if */ // Branch unreachable with valid types
        if (!__classPrivateFieldGet(this, _RestrictedMessenger_instances, "m", _RestrictedMessenger_isInCurrentNamespace).call(this, event)) {
            throw new Error(`Only allowed publishing events prefixed by '${__classPrivateFieldGet(this, _RestrictedMessenger_namespace, "f")}:'`);
        }
        __classPrivateFieldGet(this, _RestrictedMessenger_messenger, "f").publish(event, ...payload);
    }
    subscribe(event, handler, selector) {
        if (!__classPrivateFieldGet(this, _RestrictedMessenger_instances, "m", _RestrictedMessenger_isAllowedEvent).call(this, event)) {
            throw new Error(`Event missing from allow list: ${event}`);
        }
        if (selector) {
            return __classPrivateFieldGet(this, _RestrictedMessenger_messenger, "f").subscribe(event, handler, selector);
        }
        return __classPrivateFieldGet(this, _RestrictedMessenger_messenger, "f").subscribe(event, handler);
    }
    /**
     * Unsubscribe from an event.
     *
     * Unregisters the given function as an event handler for the given event.
     *
     * The event type being unsubscribed to must be on the event allowlist.
     *
     * @param event - The event type. This is a unique identifier for this event.
     * @param handler - The event handler to unregister.
     * @throws Will throw if the given event is not an allowed event for this messenger.
     * @template EventType - A type union of allowed Event type strings.
     * @template SelectorReturnValue - The selector return value.
     */
    unsubscribe(event, handler) {
        if (!__classPrivateFieldGet(this, _RestrictedMessenger_instances, "m", _RestrictedMessenger_isAllowedEvent).call(this, event)) {
            throw new Error(`Event missing from allow list: ${event}`);
        }
        __classPrivateFieldGet(this, _RestrictedMessenger_messenger, "f").unsubscribe(event, handler);
    }
    /**
     * Clear subscriptions for a specific event.
     *
     * This will remove all subscribed handlers for this event.
     *
     * The event type being cleared *must* be in the current namespace.
     *
     * @param event - The event type. This is a unique identifier for this event.
     * @throws Will throw if a subscription for an event that is not in the current namespace is being cleared.
     * @template EventType - A type union of Event type strings that are namespaced by Namespace.
     */
    clearEventSubscriptions(event) {
        if (!__classPrivateFieldGet(this, _RestrictedMessenger_instances, "m", _RestrictedMessenger_isInCurrentNamespace).call(this, event)) {
            throw new Error(`Only allowed clearing events prefixed by '${__classPrivateFieldGet(this, _RestrictedMessenger_namespace, "f")}:'`);
        }
        __classPrivateFieldGet(this, _RestrictedMessenger_messenger, "f").clearEventSubscriptions(event);
    }
}
exports.RestrictedMessenger = RestrictedMessenger;
_RestrictedMessenger_messenger = new WeakMap(), _RestrictedMessenger_namespace = new WeakMap(), _RestrictedMessenger_allowedActions = new WeakMap(), _RestrictedMessenger_allowedEvents = new WeakMap(), _RestrictedMessenger_instances = new WeakSet(), _RestrictedMessenger_isAllowedEvent = function _RestrictedMessenger_isAllowedEvent(eventType) {
    // Safely upcast to allow runtime check
    const allowedEvents = __classPrivateFieldGet(this, _RestrictedMessenger_allowedEvents, "f");
    return (__classPrivateFieldGet(this, _RestrictedMessenger_instances, "m", _RestrictedMessenger_isInCurrentNamespace).call(this, eventType) ||
        (allowedEvents !== null && allowedEvents.includes(eventType)));
}, _RestrictedMessenger_isAllowedAction = function _RestrictedMessenger_isAllowedAction(actionType) {
    // Safely upcast to allow runtime check
    const allowedActions = __classPrivateFieldGet(this, _RestrictedMessenger_allowedActions, "f");
    return (__classPrivateFieldGet(this, _RestrictedMessenger_instances, "m", _RestrictedMessenger_isInCurrentNamespace).call(this, actionType) ||
        (allowedActions !== null && allowedActions.includes(actionType)));
}, _RestrictedMessenger_isInCurrentNamespace = function _RestrictedMessenger_isInCurrentNamespace(name) {
    return name.startsWith(`${__classPrivateFieldGet(this, _RestrictedMessenger_namespace, "f")}:`);
};
//# sourceMappingURL=RestrictedMessenger.cjs.map