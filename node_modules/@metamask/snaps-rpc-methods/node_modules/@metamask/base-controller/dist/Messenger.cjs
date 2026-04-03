"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Messenger_actions, _Messenger_events, _Messenger_initialEventPayloadGetters, _Messenger_eventPayloadCache;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Messenger = void 0;
const RestrictedMessenger_1 = require("./RestrictedMessenger.cjs");
/**
 * A message broker for "actions" and "events".
 *
 * The messenger allows registering functions as 'actions' that can be called elsewhere,
 * and it allows publishing and subscribing to events. Both actions and events are identified by
 * unique strings.
 *
 * @template Action - A type union of all Action types.
 * @template Event - A type union of all Event types.
 */
class Messenger {
    constructor() {
        _Messenger_actions.set(this, new Map());
        _Messenger_events.set(this, new Map());
        /**
         * A map of functions for getting the initial event payload.
         *
         * Used only for events that represent state changes.
         */
        _Messenger_initialEventPayloadGetters.set(this, new Map());
        /**
         * A cache of selector return values for their respective handlers.
         */
        _Messenger_eventPayloadCache.set(this, new Map());
    }
    /**
     * Register an action handler.
     *
     * This will make the registered function available to call via the `call` method.
     *
     * @param actionType - The action type. This is a unique identifier for this action.
     * @param handler - The action handler. This function gets called when the `call` method is
     * invoked with the given action type.
     * @throws Will throw when a handler has been registered for this action type already.
     * @template ActionType - A type union of Action type strings.
     */
    registerActionHandler(actionType, handler) {
        if (__classPrivateFieldGet(this, _Messenger_actions, "f").has(actionType)) {
            throw new Error(`A handler for ${actionType} has already been registered`);
        }
        __classPrivateFieldGet(this, _Messenger_actions, "f").set(actionType, handler);
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
        for (const methodName of methodNames) {
            const method = messengerClient[methodName];
            if (typeof method === 'function') {
                const actionType = `${messengerClient.name}:${methodName}`;
                this.registerActionHandler(actionType, method.bind(messengerClient));
            }
        }
    }
    /**
     * Unregister an action handler.
     *
     * This will prevent this action from being called.
     *
     * @param actionType - The action type. This is a unique identifier for this action.
     * @template ActionType - A type union of Action type strings.
     */
    unregisterActionHandler(actionType) {
        __classPrivateFieldGet(this, _Messenger_actions, "f").delete(actionType);
    }
    /**
     * Unregister all action handlers.
     *
     * This prevents all actions from being called.
     */
    clearActions() {
        __classPrivateFieldGet(this, _Messenger_actions, "f").clear();
    }
    /**
     * Call an action.
     *
     * This function will call the action handler corresponding to the given action type, passing
     * along any parameters given.
     *
     * @param actionType - The action type. This is a unique identifier for this action.
     * @param params - The action parameters. These must match the type of the parameters of the
     * registered action handler.
     * @throws Will throw when no handler has been registered for the given type.
     * @template ActionType - A type union of Action type strings.
     * @returns The action return value.
     */
    call(actionType, ...params) {
        const handler = __classPrivateFieldGet(this, _Messenger_actions, "f").get(actionType);
        if (!handler) {
            throw new Error(`A handler for ${actionType} has not been registered`);
        }
        return handler(...params);
    }
    /**
     * Register a function for getting the initial payload for an event.
     *
     * This is used for events that represent a state change, where the payload is the state.
     * Registering a function for getting the payload allows event selectors to have a point of
     * comparison the first time state changes.
     *
     * @param args - The arguments to this function
     * @param args.eventType - The event type to register a payload for.
     * @param args.getPayload - A function for retrieving the event payload.
     * @template EventType - A type union of Event type strings.
     */
    registerInitialEventPayload({ eventType, getPayload, }) {
        __classPrivateFieldGet(this, _Messenger_initialEventPayloadGetters, "f").set(eventType, getPayload);
    }
    /**
     * Publish an event.
     *
     * Publishes the given payload to all subscribers of the given event type.
     *
     * Note that this method should never throw directly. Any errors from
     * subscribers are captured and re-thrown in a timeout handler.
     *
     * @param eventType - The event type. This is a unique identifier for this event.
     * @param payload - The event payload. The type of the parameters for each event handler must
     * match the type of this payload.
     * @template EventType - A type union of Event type strings.
     */
    publish(eventType, ...payload) {
        const subscribers = __classPrivateFieldGet(this, _Messenger_events, "f").get(eventType);
        if (subscribers) {
            for (const [handler, selector] of subscribers.entries()) {
                try {
                    if (selector) {
                        const previousValue = __classPrivateFieldGet(this, _Messenger_eventPayloadCache, "f").get(handler);
                        const newValue = selector(...payload);
                        if (newValue !== previousValue) {
                            __classPrivateFieldGet(this, _Messenger_eventPayloadCache, "f").set(handler, newValue);
                            handler(newValue, previousValue);
                        }
                    }
                    else {
                        handler(...payload);
                    }
                }
                catch (error) {
                    // Throw error after timeout so that it is capured as a console error
                    // (and by Sentry) without interrupting the event publishing.
                    setTimeout(() => {
                        throw error;
                    });
                }
            }
        }
    }
    subscribe(eventType, handler, selector) {
        let subscribers = __classPrivateFieldGet(this, _Messenger_events, "f").get(eventType);
        if (!subscribers) {
            subscribers = new Map();
            __classPrivateFieldGet(this, _Messenger_events, "f").set(eventType, subscribers);
        }
        // Widen type of event handler by dropping ReturnType parameter.
        //
        // We need to drop it here because it's used as the parameter to the event handler, and
        // functions in general are contravarient over the parameter type. This means the type is no
        // longer valid once it's added to a broader type union with other handlers (because as far
        // as TypeScript knows, we might call the handler with output from a different selector).
        //
        // This cast means the type system is not guaranteeing the handler is called with the matching
        // input selector return value. The parameter types do ensure they match when `subscribe` is
        // called, but past that point we need to make sure of that with manual review and tests
        // instead.
        const widenedHandler = handler;
        subscribers.set(widenedHandler, selector);
        if (selector) {
            const getPayload = __classPrivateFieldGet(this, _Messenger_initialEventPayloadGetters, "f").get(eventType);
            if (getPayload) {
                const initialValue = selector(...getPayload());
                __classPrivateFieldGet(this, _Messenger_eventPayloadCache, "f").set(widenedHandler, initialValue);
            }
        }
    }
    /**
     * Unsubscribe from an event.
     *
     * Unregisters the given function as an event handler for the given event.
     *
     * @param eventType - The event type. This is a unique identifier for this event.
     * @param handler - The event handler to unregister.
     * @throws Will throw when the given event handler is not registered for this event.
     * @template EventType - A type union of Event type strings.
     * @template SelectorReturnValue - The selector return value.
     */
    unsubscribe(eventType, handler) {
        const subscribers = __classPrivateFieldGet(this, _Messenger_events, "f").get(eventType);
        // Widen type of event handler by dropping ReturnType parameter.
        //
        // We need to drop it here because it's used as the parameter to the event handler, and
        // functions in general are contravarient over the parameter type. This means the type is no
        // longer valid once it's added to a broader type union with other handlers (because as far
        // as TypeScript knows, we might call the handler with output from a different selector).
        //
        // This poses no risk in this case, since we never call the handler past this point.
        const widenedHandler = handler;
        if (!subscribers || !subscribers.has(widenedHandler)) {
            throw new Error(`Subscription not found for event: ${eventType}`);
        }
        const selector = subscribers.get(widenedHandler);
        if (selector) {
            __classPrivateFieldGet(this, _Messenger_eventPayloadCache, "f").delete(widenedHandler);
        }
        subscribers.delete(widenedHandler);
    }
    /**
     * Clear subscriptions for a specific event.
     *
     * This will remove all subscribed handlers for this event.
     *
     * @param eventType - The event type. This is a unique identifier for this event.
     * @template EventType - A type union of Event type strings.
     */
    clearEventSubscriptions(eventType) {
        __classPrivateFieldGet(this, _Messenger_events, "f").delete(eventType);
    }
    /**
     * Clear all subscriptions.
     *
     * This will remove all subscribed handlers for all events.
     */
    clearSubscriptions() {
        __classPrivateFieldGet(this, _Messenger_events, "f").clear();
    }
    /**
     * Get a restricted messenger
     *
     * Returns a wrapper around the messenger instance that restricts access to actions and events.
     * The provided allowlists grant the ability to call the listed actions and subscribe to the
     * listed events. The "name" provided grants ownership of any actions and events under that
     * namespace. Ownership allows registering actions and publishing events, as well as
     * unregistering actions and clearing event subscriptions.
     *
     * @param options - Messenger options.
     * @param options.name - The name of the thing this messenger will be handed to (e.g. the
     * controller name). This grants "ownership" of actions and events under this namespace to the
     * restricted messenger returned.
     * @param options.allowedActions - The list of actions that this restricted messenger should be
     * allowed to call.
     * @param options.allowedEvents - The list of events that this restricted messenger should be
     * allowed to subscribe to.
     * @template Namespace - The namespace for this messenger. Typically this is the name of the
     * module that this messenger has been created for. The authority to publish events and register
     * actions under this namespace is granted to this restricted messenger instance.
     * @template AllowedAction - A type union of the 'type' string for any allowed actions.
     * This must not include internal actions that are in the messenger's namespace.
     * @template AllowedEvent - A type union of the 'type' string for any allowed events.
     * This must not include internal events that are in the messenger's namespace.
     * @returns The restricted messenger.
     */
    getRestricted({ name, allowedActions, allowedEvents, }) {
        return new RestrictedMessenger_1.RestrictedMessenger({
            messenger: this,
            name,
            allowedActions,
            allowedEvents,
        });
    }
}
exports.Messenger = Messenger;
_Messenger_actions = new WeakMap(), _Messenger_events = new WeakMap(), _Messenger_initialEventPayloadGetters = new WeakMap(), _Messenger_eventPayloadCache = new WeakMap();
//# sourceMappingURL=Messenger.cjs.map