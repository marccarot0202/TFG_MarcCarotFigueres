export class ApprovalRequestNotFoundError extends Error {
    constructor(id) {
        super(`Approval request with id '${id}' not found.`);
    }
}
export class ApprovalRequestNoResultSupportError extends Error {
    constructor(id) {
        super(`Approval acceptance requested result but request with id '${id}' does not support it.`);
    }
}
export class NoApprovalFlowsError extends Error {
    constructor() {
        super(`No approval flows found.`);
    }
}
export class EndInvalidFlowError extends Error {
    constructor(id, flowIds) {
        super(`Attempted to end flow with id '${id}' which does not match current flow with id '${flowIds.slice(-1)[0]}'. All Flows: ${flowIds.join(', ')}`);
    }
}
export class MissingApprovalFlowError extends Error {
    constructor(id) {
        super(`No approval flows found with id '${id}'.`);
    }
}
//# sourceMappingURL=errors.mjs.map