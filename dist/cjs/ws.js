"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsConnection = void 0;
const tslib_1 = require("tslib");
const events_1 = require("events");
const safe_json_1 = require("@walletconnect/safe-json");
const jsonrpc_utils_1 = require("@walletconnect/jsonrpc-utils");
const EVENT_EMITTER_MAX_LISTENERS_DEFAULT = 10;
const WS = typeof global.WebSocket !== "undefined" ? global.WebSocket : require("ws");
class WsConnection {
    constructor(url) {
        this.url = url;
        this.events = new events_1.EventEmitter();
        this.registering = false;
        if (!jsonrpc_utils_1.isWsUrl(url)) {
            throw new Error(`Provided URL is not compatible with WebSocket connection: ${url}`);
        }
        this.url = url;
    }
    get connected() {
        return typeof this.socket !== "undefined";
    }
    get connecting() {
        return this.registering;
    }
    on(event, listener) {
        this.events.on(event, listener);
    }
    once(event, listener) {
        this.events.once(event, listener);
    }
    off(event, listener) {
        this.events.off(event, listener);
    }
    removeListener(event, listener) {
        this.events.removeListener(event, listener);
    }
    open(url = this.url) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.register(url);
        });
    }
    close() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (typeof this.socket === "undefined") {
                throw new Error("Connection already closed");
            }
            this.socket.close();
            this.onClose();
        });
    }
    send(payload, _context) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (typeof this.socket === "undefined") {
                this.socket = yield this.register();
            }
            try {
                this.socket.send(safe_json_1.safeJsonStringify(payload));
            }
            catch (e) {
                this.onError(payload.id, e);
            }
        });
    }
    register(url = this.url) {
        if (!jsonrpc_utils_1.isWsUrl(url)) {
            throw new Error(`Provided URL is not compatible with WebSocket connection: ${url}`);
        }
        if (this.registering) {
            const currentMaxListeners = this.events.getMaxListeners();
            if (this.events.listenerCount("register_error") >= currentMaxListeners ||
                this.events.listenerCount("open") >= currentMaxListeners) {
                this.events.setMaxListeners(currentMaxListeners + 1);
            }
            return new Promise((resolve, reject) => {
                this.events.once("register_error", error => {
                    this.resetMaxListeners();
                    reject(error);
                });
                this.events.once("open", () => {
                    this.resetMaxListeners();
                    if (typeof this.socket === "undefined") {
                        return reject(new Error("WebSocket connection is missing or invalid"));
                    }
                    resolve(this.socket);
                });
            });
        }
        this.url = url;
        this.registering = true;
        return new Promise((resolve, reject) => {
            const opts = !jsonrpc_utils_1.isReactNative() ? { rejectUnauthorized: !jsonrpc_utils_1.isLocalhostUrl(url) } : undefined;
            const socket = new WS(url, [], opts);
            socket.onopen = () => {
                this.onOpen(socket);
                resolve(socket);
            };
            socket.onerror = (event) => {
                const errorEvent = event;
                const error = this.parseError(errorEvent.error || new Error(errorEvent.message));
                this.onClose();
                reject(error);
            };
        });
    }
    onOpen(socket) {
        socket.onmessage = (event) => this.onPayload(event);
        socket.onclose = () => this.onClose();
        socket.onerror = (event) => {
            const errorEvent = event;
            const error = this.parseError(errorEvent.error || new Error(errorEvent.message));
            this.events.emit("error", error);
        };
        this.socket = socket;
        this.registering = false;
        this.events.emit("open");
    }
    onClose() {
        this.socket = undefined;
        this.registering = false;
        this.events.emit("close");
    }
    onPayload(e) {
        if (typeof e.data === "undefined")
            return;
        const payload = typeof e.data === "string" ? safe_json_1.safeJsonParse(e.data) : e.data;
        this.events.emit("payload", payload);
    }
    onError(id, e) {
        const error = this.parseError(e);
        const message = error.message || error.toString();
        const payload = jsonrpc_utils_1.formatJsonRpcError(id, message);
        this.events.emit("payload", payload);
    }
    parseError(e, url = this.url) {
        return jsonrpc_utils_1.parseConnectionError(e, url, "WS");
    }
    resetMaxListeners() {
        if (this.events.getMaxListeners() > EVENT_EMITTER_MAX_LISTENERS_DEFAULT) {
            this.events.setMaxListeners(EVENT_EMITTER_MAX_LISTENERS_DEFAULT);
        }
    }
}
exports.WsConnection = WsConnection;
exports.default = WsConnection;
//# sourceMappingURL=ws.js.map